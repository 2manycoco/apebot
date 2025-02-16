import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues, TemplateActions, TemplateActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {formatMessage, Strings} from "../resources/strings";
import {Address, BN, WalletUnlocked} from "fuels";
import {DexClient} from "../../dex/dex_client";
import {shortAddress, withProgress} from "../help_functions";
import {isValidFuelAddress, transferWithFeeAdjustment} from "../../fuel/functions";
import {retry} from "../../utils/call_helper";
import {TokenInfo} from "../../dex/model";
import {replyConfirmMessage} from "../session_message_builder";

export class WithdrawFlow extends Flow {
    private userWallet: WalletUnlocked;
    private userDexClient: DexClient;

    private step: "ASSET_SELECTION" | "INPUT_ADDRESS" | "INPUT_AMOUNT" | "CONFIRMATION" | "COMPLETED" = "ASSET_SELECTION";
    private enteredAddress: string | null = null;
    private userBalance: number;
    private userBalanceBN: BN;
    private transferAmount: number | null = null;
    private transferAmountBN: BN | null = null;

    private balancesList: Array<[string, string, string, boolean]> = [];
    private assetId: string
    private assetInfo: TokenInfo

    constructor(
        ctx: Context,
        userId: number,
        userWallet: WalletUnlocked,
        userDexClient: DexClient,
        onCompleteCallback?: (flowId: string, successful: Boolean) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userWallet = userWallet;
        this.userDexClient = userDexClient;
    }

    getFlowId(): FlowValues {
        return FlowId.WITHDRAW_FLOW;
    }

    public async start(): Promise<void> {
        await withProgress(this.ctx, async () => {
            this.balancesList = await this.userDexClient.getBalances();
            if (this.balancesList.length === 0) {
                await this.ctx.reply(Strings.WITHDRAW_INSUFFICIENT_FUNDS_TEXT, {parse_mode: "Markdown"});
                this.step = "COMPLETED";
                return;
            }

            const buttons = this.balancesList.map(([assetId, symbol, amount]) => {
                return Markup.button.callback(symbol, TemplateActions.WITHDRAW(symbol));
            });


            const keyboard = Markup.inlineKeyboard(
                buttons.reduce((rows, button, index) => {
                    if (index % 3 === 0) rows.push([]);
                    rows[rows.length - 1].push(button);
                    return rows;
                }, [] as Array<Array<ReturnType<typeof Markup.button.callback>>>)
            );


            await this.handleMessageResponse(async () => {
                return await this.ctx.reply(Strings.WITHDRAW_SELECT_ASSET_TEXT, {parse_mode: "Markdown", ...keyboard});
            })
            this.step = "ASSET_SELECTION";
        });
    }

    public async handleTemplateActionInternal(action: TemplateActionValues): Promise<boolean> {
        if (this.step === "ASSET_SELECTION") {
            const {type, symbol} = action;
            if (type == "WITHDRAW") {

                const selectedAsset = this.balancesList.find(asset => asset[1] === symbol);
                if (!selectedAsset) {
                    await this.ctx.reply(Strings.WITHDRAW_SELECT_ASSET_ERROR, {parse_mode: "Markdown"});
                    return true;
                }

                this.assetId = selectedAsset[0]
                const [amount, amountBN] = await this.userDexClient.getBalance(this.assetId);
                this.userBalance = amount;
                this.userBalanceBN = amountBN;

                if (this.userBalanceBN.eq(0)) {
                    await this.ctx.reply(Strings.WITHDRAW_INSUFFICIENT_FUNDS_TEXT, {parse_mode: "Markdown"});
                    this.step = "COMPLETED";
                    return Promise.resolve(true);
                } else {
                    this.assetInfo = await this.userDexClient.getTokenInfo(this.assetId);
                    const message = formatMessage(Strings.WITHDRAW_INPUT_TEXT, amount, this.assetInfo.symbol)
                    await this.handleMessageResponse(async () => {
                        this.step = "INPUT_ADDRESS";
                        return await this.ctx.reply(message, {parse_mode: "Markdown"});
                    });
                }
            }
        }

        return false;
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step === "CONFIRMATION") {
            if (action === Actions.CANCEL) {
                this.step = "COMPLETED";
                return true;
            }

            if (action === Actions.CONFIRM) {
                await withProgress(this.ctx, async () => {
                    const destinationAddress = Address.fromAddressOrString(this.enteredAddress);
                    await retry(() => {
                        return transferWithFeeAdjustment(this.userWallet, destinationAddress, this.assetId, this.transferAmountBN!);
                    }, 10);

                    await this.ctx.reply(Strings.WITHDRAW_SUCCESS_TEXT, {parse_mode: "Markdown"});
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        if (this.step === "INPUT_AMOUNT") {
            if (action === Actions.PERCENT_100) {
                this.transferAmount = this.userBalance;
                this.transferAmountBN = this.userBalanceBN;
                await this.confirmTransfer();
                return true;
            }
        }

        return Promise.resolve(false);
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step === "INPUT_ADDRESS") {
            const isValidAddress = isValidFuelAddress(message);
            if (!isValidAddress) {
                await this.handleMessageResponse(async () => {
                    return await this.ctx.reply(Strings.INVALID_ADDRESS_TEXT, {parse_mode: "Markdown"});
                });
                return true;
            }

            this.enteredAddress = message;
            await this.handleMessageResponse(async () => {
                this.step = "INPUT_AMOUNT";
                return await this.ctx.reply(Strings.WITHDRAW_AMOUNT_TEXT, {
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback(Strings.PERCENT_100, Actions.PERCENT_100)],
                    ]),
                });
            });
            return true;
        }

        if (this.step === "INPUT_AMOUNT") {
            const amount = parseFloat(message);
            if (isNaN(amount) || amount <= 0) {
                await this.handleMessageResponse(async () => {
                    return await this.ctx.reply(Strings.WITHDRAW_INPUT_AMOUNT_ERROR, {parse_mode: "Markdown"});
                });
                return true;
            }

            if (amount > this.userBalance) {
                await this.handleMessageResponse(async () => {
                    return await this.ctx.reply(Strings.WITHDRAW_AMOUNT_ERROR, {parse_mode: "Markdown"});
                });
                return true;
            }

            this.transferAmount = amount;
            this.transferAmountBN = await this.userDexClient.getTokenAmountBN(this.assetId, amount)
            await this.confirmTransfer();
            return true;
        }

        return false;
    }

    private async confirmTransfer(): Promise<void> {
        const formattedAddress = shortAddress(this.enteredAddress!, true)
        const confirmationMessage = `${this.transferAmount} *${this.assetInfo.symbol}* -> ${formattedAddress}`;

        this.step = "CONFIRMATION";
        await this.handleMessageResponse(async () => {
            return await replyConfirmMessage(this.ctx, confirmationMessage);
        });
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
