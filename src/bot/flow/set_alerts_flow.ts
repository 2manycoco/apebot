import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";

export class SetAlertsFlow extends Flow {
    private step: "SELECTING" | "COMPLETED" = "SELECTING";
    private currentAlertsEnabled: boolean;

    constructor(ctx: Context, userId: number, onCompleteCallback?: (flowId: string, successful: boolean) => void) {
        super(ctx, userId, onCompleteCallback);
    }

    getFlowId(): FlowValues {
        return FlowId.SET_ALERTS_FLOW;
    }

    public async start(): Promise<void> {
        this.currentAlertsEnabled = await this.userManager.isNotificationsEnabled();
        const statusText = this.currentAlertsEnabled ? Strings.ENABLED : Strings.DISABLED;
        const message = formatMessage(Strings.SET_ALERTS_START_TEXT, statusText);

        const toggleButtonText = this.currentAlertsEnabled ? Strings.BUTTON_DISABLE : Strings.BUTTON_ENABLE;

        await this.handleMessageResponse(async () => {
            this.step = "SELECTING";
            return await this.ctx.reply(message, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(Strings.BUTTON_CANCEL, Actions.CANCEL), Markup.button.callback(toggleButtonText, Actions.CONFIRM)]
                ])
            });
        });
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step !== "SELECTING") return false;

        if (action === Actions.CANCEL) {
            this.step = "COMPLETED";
            return true;
        }

        if (action === Actions.CONFIRM) {
            const newValue = !this.currentAlertsEnabled;
            await this.userManager.saveNotificationsEnabled(newValue);
            const confirmation = newValue ? Strings.SET_ALERTS_ENABLED : Strings.SET_ALERTS_DISABLED;
            await this.ctx.reply(confirmation, {parse_mode: "Markdown"});
            this.step = "COMPLETED";
            return true;
        }

        return false;
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        // Обработка текстовых сообщений не требуется в этом Flow.
        return false;
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
