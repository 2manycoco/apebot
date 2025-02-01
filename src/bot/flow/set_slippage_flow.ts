import { Flow } from "./flow";
import { Context, Markup } from "telegraf";
import { Actions, ActionValues } from "../actions";
import { FlowId, FlowValues } from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";

export class SetSlippageFlow extends Flow {
    private step: "SELECTING" | "COMPLETED" = "SELECTING";
    private selectedSlippage: number | null = null;

    constructor(ctx: Context, userId: number, onCompleteCallback?: (flowId: string, successful: Boolean) => void) {
        super(ctx, userId, onCompleteCallback);
    }

    getFlowId(): FlowValues {
        return FlowId.SET_SLIPPAGE_FLOW;
    }

    public async start(): Promise<void> {
        const currentSlippage = await this.userManager.getSlippage()
        const message = formatMessage(Strings.SET_SLIPPAGE_START_TEXT, currentSlippage);

        await this.handleMessageResponse(async () => {
            this.step = "SELECTING";
            return await this.ctx.reply(message, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(Strings.PERCENT_0_1, Actions.SLIPPAGE_0_1),
                        Markup.button.callback(Strings.PERCENT_0_5, Actions.SLIPPAGE_0_5),
                        Markup.button.callback(Strings.PERCENT_1, Actions.SLIPPAGE_1),
                    ],
                ]),
            });
        });
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step !== "SELECTING") return false;

        const slippageValues = {
            [Actions.SLIPPAGE_0_1]: 0.1,
            [Actions.SLIPPAGE_0_5]: 0.5,
            [Actions.SLIPPAGE_1]: 1,
        };

        if (slippageValues[action] !== undefined) {
            this.selectedSlippage = slippageValues[action];
            await this.saveSlippage();
            return true;
        }

        return false;
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step !== "SELECTING") return false;

        const enteredValue = parseFloat(message);
        if (isNaN(enteredValue) || enteredValue < 0.1 || enteredValue > 75) {
            await this.ctx.reply(Strings.SET_SLIPPAGE_PERCENTAGE_ERROR, {
                parse_mode: "Markdown",
            });
            return false;
        }

        this.selectedSlippage = enteredValue;
        await this.saveSlippage();
        return true;
    }

    private async saveSlippage(): Promise<void> {
        await this.userManager.saveSlippage(this.selectedSlippage)

        await this.ctx.reply(formatMessage(Strings.SET_SLIPPAGE_SUCCESS, this.selectedSlippage), {
            parse_mode: "Markdown",
        });
        this.step = "COMPLETED";
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
