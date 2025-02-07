import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";
import {formatTokenNumber, withProgress} from "../help_functions";
import {DexClient} from "../../dex/dex_client";
import {TokenInfo} from "../../dex/model";
import {CONTRACTS, TRADE_ASSET} from "../../fuel/asset/contracts";
import {replyConfirmMessage} from "../session_message_builder";
import {getTransactionRepository} from "../../database/transaction_repository";
import {Position, Transaction} from "../../database/entities";
import {getPositionRepository} from "../../database/position_repository";

export class BuyFlow extends Flow {
    private step: "INPUT_ASSET" | "INPUT_AMOUNT" | "CONFIRMATION" | "COMPLETED" = "INPUT_ASSET";
    private userDexClient: DexClient;
    private assetId: string | null;

    private tradeAsset = CONTRACTS.ASSET_FUEL;
    private tradeBalance: number;

    private amountToSpend: number | null = null;
    private expectedOutAmount: number | null = null;
    private tokenInfo: TokenInfo;

    private successful: boolean = false;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        assetId: string | null = null,
        onCompleteCallback?: (flowId: string, successful: Boolean) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
        this.assetId = assetId;
    }

    getFlowId(): FlowValues {
        return FlowId.BUY_FLOW;
    }

    public async start(): Promise<void> {
        if (!this.assetId) {
            await this.handleMessageResponse(async () => {
                return await this.ctx.reply(Strings.BUY_ENTER_ASSET, {parse_mode: "Markdown"});
            })
            return;
        }

        await this.processAsset();
    }

    private async processAsset(): Promise<void> {
        const result = await withProgress(this.ctx, async () => {
            this.tokenInfo = await this.userDexClient.getTokenInfo(this.assetId!);

            const [tradeBalance] = await this.userDexClient.getBalance(TRADE_ASSET.bits);
            this.tradeBalance = tradeBalance;

            if (tradeBalance === 0) {
                await this.ctx.reply(Strings.BUY_INSUFFICIENT_FUNDS_TEXT, {parse_mode: "Markdown"});
                this.step = "COMPLETED";
                return Promise.resolve(false);
            }

            return Promise.resolve(true);
        });

        if (!result) return;

        const message = await withProgress(this.ctx, async () => {
            return formatMessage(
                Strings.BUY_START_TEXT,
                this.tokenInfo.symbol,
                this.tradeBalance,
                TRADE_ASSET.symbol
            );
        });

        await this.handleMessageResponse(async () => {
            this.step = "INPUT_AMOUNT";
            return await this.ctx.reply(message, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(Strings.AMOUNT_500_FUEL, Actions.AMOUNT_500),
                        Markup.button.callback(Strings.AMOUNT_1000_FUEL, Actions.AMOUNT_1000),
                        Markup.button.callback(Strings.AMOUNT_2000_FUEL, Actions.AMOUNT_1500),
                    ],
                ]),
            });
        });
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step === "INPUT_ASSET") {
            if (!message || message.trim().length === 0) {
                await this.ctx.reply(Strings.BUY_ENTER_ASSET_ERROR, {parse_mode: "Markdown"});
                return false;
            }

            this.assetId = message.trim();
            await this.processAsset();
            return true;
        }

        if (this.step === "INPUT_AMOUNT") {
            const enteredValue = parseFloat(message);
            if (isNaN(enteredValue) || enteredValue <= 0 || enteredValue > this.tradeBalance) {
                await this.ctx.reply(Strings.BUY_AMOUNT_ERROR, {parse_mode: "Markdown"});
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
                [Actions.AMOUNT_500]: 500,
                [Actions.AMOUNT_1000]: 1000,
                [Actions.AMOUNT_1500]: 1500,
            };

            if (amountMap[action] !== undefined) {
                this.amountToSpend = amountMap[action];
                if (this.amountToSpend > this.tradeBalance) {
                    await this.ctx.reply(Strings.BUY_AMOUNT_ERROR, {parse_mode: "Markdown"});
                    return true;
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

            if (action === Actions.CONFIRM) {
                await withProgress(this.ctx, async () => {
                    const slippage = await this.userManager.getSlippage()
                    await this.userDexClient.swap(this.tradeAsset.bits, this.assetId!, this.amountToSpend!, slippage);
                    await this.confirmBuy();
                    await this.ctx.reply(Strings.BUY_SUCCESS, {parse_mode: "Markdown"});
                    this.successful = true;
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        return false;
    }

    private async calculateAndConfirmPurchase(): Promise<void> {
        const confirmationMessage = await withProgress(this.ctx, async () => {
            this.expectedOutAmount = await this.userDexClient.calculateSwapAmount(
                this.tradeAsset.bits,
                this.assetId!,
                this.amountToSpend
            );

            return formatMessage(
                Strings.BUY_CONFIRMATION_TEXT,
                this.amountToSpend,
                formatTokenNumber(this.expectedOutAmount),
                this.tokenInfo.symbol
            );
        });

        this.step = "CONFIRMATION";
        await this.handleMessageResponse(async () => {
            return await replyConfirmMessage(this.ctx, confirmationMessage);
        });
    }

    private async confirmBuy() {
        const repository = getTransactionRepository()
        const transaction = new Transaction()
        transaction.userId = this.userId;
        transaction.assetIdIn = this.tradeAsset.bits;
        transaction.amountIn = this.amountToSpend;
        transaction.assetIdOut = this.tokenInfo.assetId;
        transaction.amountOut = this.expectedOutAmount;
        transaction.timestamp = Date.now();

        await repository.addTransaction(transaction)
        await this.updatePosition(transaction)
    }

    private async updatePosition(transaction: Transaction) {
        const repository = getPositionRepository()
        const position = await repository.findPositionByPair(this.userId, this.tradeAsset.bits, this.tokenInfo.assetId)
        if (position == null) {
            const position = new Position();
            position.transaction = transaction;
            position.userId = this.userId;
            position.timestamp = Date.now();

            await repository.addPosition(position)
        }
    }

    protected override isSuccessful(): boolean {
        return this.successful
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
