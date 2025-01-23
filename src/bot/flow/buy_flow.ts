import { Flow } from "./flow";
import { Context, Markup } from "telegraf";
import { Actions, ActionValues } from "../actions";
import { FlowId, FlowValues } from "./flow_ids";
import { formatMessage, Strings } from "../resources/strings";
import {formatTokenNumber, withProgress} from "../help_functions";
import { DexClient } from "../../dex/dex_client";
import { TokenInfo } from "../../dex/model";
import { CONTRACTS } from "../../fuel/asset/contracts";
import { BN } from "fuels";
import {replyConfirmMessage} from "../session_message_builder";

export class BuyFlow extends Flow {
    private step: "INPUT_ASSET" | "INPUT_AMOUNT" | "CONFIRMATION" | "COMPLETED" = "INPUT_ASSET";
    private userDexClient: DexClient;
    private asset: string | null;

    private ethBalance: number;
    private amountToSpend: number | null = null;
    private expectedTokenAmount: BN | null = null;
    private tokenInfo: TokenInfo;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        asset: string | null = null,
        onCompleteCallback?: (flowId: string) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
        this.asset = asset;
    }

    getFlowId(): FlowValues {
        return FlowId.BUY_FLOW;
    }

    public async start(): Promise<void> {
        if (!this.asset) {
            await this.ctx.reply(Strings.BUY_ENTER_ASSET, { parse_mode: "Markdown" });
            return;
        }

        await this.processAsset();
    }

    private async processAsset(): Promise<void> {
        const result = await withProgress(this.ctx, async () => {
            this.tokenInfo = await this.userDexClient.getTokenInfo(this.asset!);
            const [ethBalance] = await this.userDexClient.getBalance(CONTRACTS.ASSET_ETH.bits);
            this.ethBalance = ethBalance;

            if (ethBalance === 0) {
                await this.ctx.reply(Strings.BUY_INSUFFICIENT_FUNDS_TEXT, { parse_mode: "Markdown" });
                this.step = "COMPLETED";
                return Promise.resolve(false);
            }

            return Promise.resolve(true);
        });

        if (!result) return;

        const message = await withProgress(this.ctx, async () => {
            const expectedTokenAmountUSDC = await this.userDexClient.calculateSwapAmount(
                CONTRACTS.ASSET_USDC.bits,
                this.asset!,
                100
            );
            const priceUSDC = formatTokenNumber(100 / expectedTokenAmountUSDC)

            return formatMessage(
                Strings.BUY_START_TEXT,
                this.tokenInfo.symbol,
                priceUSDC,
                this.ethBalance
            );
        });

        await this.handleMessageResponse(async () => {
            this.step = "INPUT_AMOUNT";
            return await this.ctx.reply(message, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(Strings.AMOUNT_0_002, Actions.AMOUNT_0_002),
                        Markup.button.callback(Strings.AMOUNT_0_005, Actions.AMOUNT_0_005),
                        Markup.button.callback(Strings.AMOUNT_0_01, Actions.AMOUNT_0_01),
                    ],
                ]),
            });
        });
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step === "INPUT_ASSET") {
            if (!message || message.trim().length === 0) {
                await this.ctx.reply(Strings.BUY_ENTER_ASSET_ERROR, { parse_mode: "Markdown" });
                return false;
            }

            this.asset = message.trim();
            await this.processAsset();
            return true;
        }

        if (this.step === "INPUT_AMOUNT") {
            const enteredValue = parseFloat(message);
            if (isNaN(enteredValue) || enteredValue <= 0 || enteredValue > this.ethBalance) {
                await this.ctx.reply(Strings.BUY_AMOUNT_ERROR, { parse_mode: "Markdown" });
                return false;
            }

            this.amountToSpend = enteredValue;
            await this.calculateAndConfirmPurchase();
            return true;
        }

        return false;
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step === "INPUT_AMOUNT") {
            const amountMap = {
                [Actions.AMOUNT_0_002]: 0.002,
                [Actions.AMOUNT_0_005]: 0.005,
                [Actions.AMOUNT_0_01]: 0.01,
            };

            if (amountMap[action] !== undefined) {
                this.amountToSpend = amountMap[action];
                if (this.amountToSpend > this.ethBalance) {
                    await this.ctx.reply(Strings.BUY_AMOUNT_ERROR, { parse_mode: "Markdown" });
                    return false;
                }
                await this.calculateAndConfirmPurchase();
                return true;
            }
        }

        if (this.step === "CONFIRMATION") {
            if (action === Actions.CANCEL) {
                this.step = "COMPLETED";
                return true;
            }

            if (action === Actions.ACCEPT) {
                await withProgress(this.ctx, async () => {
                    const slippage = await this.userManager.getSlippage()
                    await this.userDexClient.swap(CONTRACTS.ASSET_ETH.bits, this.asset!, this.amountToSpend!, slippage);
                    await this.ctx.reply(Strings.BUY_SUCCESS, { parse_mode: "Markdown" });
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        return false;
    }

    private async calculateAndConfirmPurchase(): Promise<void> {
        const confirmationMessage =  await withProgress(this.ctx, async () => {
            const expectedTokenAmount = await this.userDexClient.calculateSwapAmount(
                CONTRACTS.ASSET_ETH.bits,
                this.asset!,
                this.amountToSpend
            );

            return formatMessage(
                Strings.BUY_CONFIRMATION_TEXT,
                this.amountToSpend,
                expectedTokenAmount.toString(),
                this.tokenInfo.symbol
            );
        });

        this.step = "CONFIRMATION";
        await this.handleMessageResponse(async () => {
            return await replyConfirmMessage(this.ctx, confirmationMessage);
        });
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
