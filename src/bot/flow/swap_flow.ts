import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";
import {formatTokenNumber, withProgress} from "../help_functions";
import {DexClient} from "../../dex/dex_client";
import {TokenInfo} from "../../dex/model";
import {CONTRACTS} from "../../fuel/asset/contracts";
import {replyConfirmMessage} from "../session_message_builder";

export class SwapFlow extends Flow {
    private step: "SELECT_PERCENTAGE" | "CONFIRMATION" | "COMPLETED" = "SELECT_PERCENTAGE";
    private userDexClient: DexClient;
    private assetIn: string;
    private assetOut: string;
    private amountPercentage: number | null = null;
    private swapAmount: number | null = null;

    private assetInInfo: TokenInfo;
    private assetOutInfo: TokenInfo;
    private assetInBalance: number;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        assetIn: string,
        assetOut: string,
        amountPercentage: number | null = null,
        onCompleteCallback?: (flowId: string) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
        this.assetIn = assetIn;
        this.assetOut = assetOut;
        this.amountPercentage = amountPercentage;
    }

    getFlowId(): FlowValues {
        return FlowId.SWAP_FLOW;
    }

    public async start(): Promise<void> {
        if (this.amountPercentage !== null) {
            const result = this.validatePercentage(this.amountPercentage);
            if (!result) {
                this.step = "COMPLETED";
                return;
            }
        }

        const result = await withProgress(this.ctx, async () => {
            this.assetInInfo = await this.userDexClient.getTokenInfo(this.assetIn);
            this.assetOutInfo = await this.userDexClient.getTokenInfo(this.assetOut);
            const [balance] = await this.userDexClient.getBalance(this.assetIn);

            this.assetInBalance = balance;

            if (balance === 0) {
                await this.ctx.reply(Strings.SWAP_INSUFFICIENT_FUNDS_TEXT, {parse_mode: "Markdown"});
                this.step = "COMPLETED";
                return Promise.resolve(false);
            }
            return Promise.resolve(true);
        });

        if (!result) return;

        if (this.amountPercentage !== null) {
            this.calculateSwapAmountByPercentage()
            await this.calculateAndConfirmSwap();
            return;
        }

        const message = await withProgress(this.ctx, async () => {
            const assertInUSDC = await this.userDexClient.getRate(this.assetIn, CONTRACTS.ASSET_USDC.bits) * this.assetInBalance
            return formatMessage(
                Strings.SWAP_START_TEXT,
                this.assetInInfo.symbol,
                this.assetOutInfo.symbol,
                this.assetInBalance,
                this.assetInInfo.symbol,
                formatTokenNumber(assertInUSDC),
                CONTRACTS.ASSET_USDC.symbol
            );
        })

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
        if (this.step == "SELECT_PERCENTAGE") {
            const percentageMap = {
                [Actions.PERCENT_25]: 25,
                [Actions.PERCENT_50]: 50,
                [Actions.PERCENT_100]: 100,
            };

            if (percentageMap[action] !== undefined) {
                this.amountPercentage = percentageMap[action]
                this.calculateSwapAmountByPercentage()
                await this.calculateAndConfirmSwap();
                return true;
            }
        }

        if (this.step == "CONFIRMATION") {
            if (action === Actions.CANCEL) {
                this.step = "COMPLETED";
                return true;
            }

            if (action === Actions.ACCEPT) {
                await withProgress(this.ctx, async () => {
                    const slippage = await this.userManager.getSlippage()
                    await this.userDexClient.swap(this.assetIn, this.assetOut, this.swapAmount!, slippage);
                    await this.ctx.reply(Strings.SWAP_SUCCESS, {parse_mode: "Markdown"});
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        return false;
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step !== "SELECT_PERCENTAGE") return false;

        const enteredValue = parseFloat(message);
        if (isNaN(enteredValue) || enteredValue <= 0 || enteredValue > 100) {
            await this.ctx.reply(Strings.SWAP_PERCENTAGE_ERROR, {
                parse_mode: "Markdown",
            });
            return false;
        }

        this.amountPercentage = enteredValue;
        this.calculateSwapAmountByPercentage();
        await this.calculateAndConfirmSwap();
        return true;
    }

    private calculateSwapAmountByPercentage(): void {
        this.swapAmount = (this.assetInBalance * this.amountPercentage) / 100;
    }

    private async calculateAndConfirmSwap(): Promise<void> {
        const confirmationMessage = await withProgress(this.ctx, async () => {
            const amountOut = await this.userDexClient.calculateSwapAmount(this.assetIn, this.assetOut, this.swapAmount!);

            return formatMessage(
                Strings.SWAP_CONFIRMATION_TEXT,
                this.swapAmount,
                this.assetInInfo.symbol,
                amountOut,
                this.assetOutInfo.symbol
            );
        });
        this.step = "CONFIRMATION";
        await this.handleMessageResponse(async () => {
            return await replyConfirmMessage(this.ctx, confirmationMessage);
        });
    }

    private async validatePercentage(percentage: number): Promise<boolean> {
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            await this.ctx.reply(Strings.SWAP_PERCENTAGE_ERROR, {
                parse_mode: "Markdown",
            });
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
