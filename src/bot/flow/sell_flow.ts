import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";
import {withProgress} from "../help_functions";
import {DexClient} from "../../dex/dex_client";
import {TokenInfo} from "../../dex/model";
import {TRADE_ASSET} from "../../fuel/asset/contracts";

export class SellFlow extends Flow {
    private step: "SELECT_PERCENTAGE" | "COMPLETED" = "SELECT_PERCENTAGE";
    private contractAddress: string;
    private userDexClient: DexClient;
    private tokenInfo: TokenInfo;
    private userBalance: number;
    private sellPercentage: number | null = null;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        contractAddress: string,
        sellPercentage: number | null = null,
        onCompleteCallback?: (flowId: string) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
        this.contractAddress = contractAddress;
        this.sellPercentage = sellPercentage;
    }

    getFlowId(): FlowValues {
        return FlowId.SELL_FLOW;
    }

    public async start(): Promise<void> {
        const result = await withProgress(this.ctx, async () => {
            const [amount] = await this.userDexClient.getBalance(this.contractAddress);
            this.userBalance = amount;
            this.tokenInfo = await this.userDexClient.getTokenInfo(this.contractAddress);

            if (amount == 0) {
                await this.ctx.reply(Strings.SELL_INSUFFICIENT_FUNDS_TEXT, {parse_mode: "Markdown"});
                this.step = "COMPLETED";
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });

        if (!result) return;

        if (this.sellPercentage !== null) {
            await this.sell();
            return;
        }

        const message = formatMessage(Strings.SELL_START_TEXT, this.userBalance, this.tokenInfo.symbol);

        await this.handleMessageResponse(async () => {
            this.step = "SELECT_PERCENTAGE";
            return await this.ctx.reply(message, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(Strings.PERCENT_25, Actions.PERCENT_25),
                        Markup.button.callback(Strings.PERCENT_50, Actions.PERCENT_50),
                        Markup.button.callback(Strings.PERCENT_100, Actions.PERCENT_100),
                    ],
                ]),
            });
        });
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step !== "SELECT_PERCENTAGE") return false;

        const percentageMap = {
            [Actions.PERCENT_25]: 25,
            [Actions.PERCENT_50]: 50,
            [Actions.PERCENT_100]: 100,
        };

        if (percentageMap[action] !== undefined) {
            this.sellPercentage = percentageMap[action];
            await this.sell();
            return true;
        }

        return false;
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step !== "SELECT_PERCENTAGE") return false;

        const enteredValue = parseFloat(message);
        if (isNaN(enteredValue) || enteredValue < 1 || enteredValue > 100) {
            await this.ctx.reply(Strings.SELL_PERCENTAGE_ERROR, {
                parse_mode: "Markdown",
            });
            return false;
        }

        this.sellPercentage = enteredValue;
        await this.sell();
        return true;
    }

    private async sell(): Promise<void> {
        const amountToSell = this.userBalance * (this.sellPercentage! / 100);
        await this.userDexClient.swap(this.contractAddress, TRADE_ASSET.bits, amountToSell)
        await this.ctx.reply(Strings.SELL_SUCCESS, {
            parse_mode: "Markdown",
        });

        this.step = "COMPLETED";
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
