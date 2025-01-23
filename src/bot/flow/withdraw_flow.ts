import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {Strings} from "../resources/strings";
import {Address, BN, WalletUnlocked} from "fuels";
import {TRADE_ASSET} from "../../fuel/asset/contracts";
import {DexClient} from "../../dex/dex_client";
import {withProgress} from "../help_functions";
import {isValidFuelAddress, transferWithFeeAdjustment} from "../../fuel/functions";
import {retry} from "../../utils/call_helper";

export class WithdrawFlow extends Flow {
    private userWallet: WalletUnlocked;
    private userDexClient: DexClient;

    private step: "INPUT_ADDRESS" | "INPUT_PERCENTAGE" | "CONFIRMATION" | "COMPLETED" = "INPUT_ADDRESS";
    private enteredAddress: string | null = null;
    private userBalance: number;
    private userBalanceBN: BN;
    private transferAmount: number | null = null;
    private transferAmountBN: BN | null = null;

    private assetId = TRADE_ASSET;

    constructor(ctx: Context, userId: number, userWallet: WalletUnlocked, userDexClient: DexClient, onCompleteCallback?: (flowId: string) => void) {
        super(ctx, userId, onCompleteCallback);
        this.userWallet = userWallet;
        this.userDexClient = userDexClient;
    }

    getFlowId(): FlowValues {
        return FlowId.WITHDRAW_FLOW;
    }

    public async start(): Promise<void> {
        await withProgress(this.ctx, async () => {
            const [amount, amountBN] = await this.userDexClient.getBalance(this.assetId.bits);
            this.userBalance = amount;
            this.userBalanceBN = amountBN;

            if (this.userBalanceBN.eq(0)) {
                await this.ctx.reply(Strings.WITHDRAW_INSUFFICIENT_FUNDS_TEXT, { parse_mode: "Markdown" });
                this.step = "COMPLETED";
                return Promise.resolve();
            } else {
                await this.handleMessageResponse(async () => {
                    this.step = "INPUT_ADDRESS";
                    return await this.ctx.reply(Strings.WITHDRAW_INPUT_TEXT, { parse_mode: "Markdown" });
                });
            }
        });
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (this.step === "CONFIRMATION") {
            if (action === Actions.CANCEL) {
                this.step = "COMPLETED";
                return true;
            }

            if (action === Actions.ACCEPT) {
                await withProgress(this.ctx, async () => {
                    const destinationAddress = Address.fromAddressOrString(this.enteredAddress);
                    await retry(() => {
                        return transferWithFeeAdjustment(this.userWallet, destinationAddress, this.assetId.bits, this.transferAmountBN!);
                    }, 10);

                    await this.ctx.reply(Strings.WITHDRAW_SUCCESS_TEXT, { parse_mode: "Markdown" });
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        if (this.step === "INPUT_PERCENTAGE") {
            const percentages = {
                [Actions.PERCENT_25]: 25,
                [Actions.PERCENT_50]: 50,
                [Actions.PERCENT_100]: 100,
            };

            if (percentages[action]) {
                await this.setTransferAmount(percentages[action]);
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
                return false;
            }

            this.enteredAddress = message;
            await this.handleMessageResponse(async () => {
                this.step = "INPUT_PERCENTAGE";
                return await this.ctx.reply(Strings.WITHDRAW_AMOUNT_TEXT, {
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
            return true;
        }

        if (this.step === "INPUT_PERCENTAGE") {
            const percentage = parseFloat(message);
            if (isNaN(percentage) || percentage < 1 || percentage > 100) {
                await this.handleMessageResponse(async () => {
                    return await this.ctx.reply(Strings.WITHDRAW_PERCENTAGE_ERROR, {parse_mode: "Markdown"});
                })
                return false;
            }

            await this.setTransferAmount(percentage);
            await this.confirmTransfer();
            return true;
        }

        return false;
    }

    private async setTransferAmount(percentage: number): Promise<void> {
        this.transferAmount = this.userBalance * (percentage / 100);
        this.transferAmountBN = this.userBalanceBN.mul(new BN(percentage)).div(new BN(100));
    }

    private async confirmTransfer(): Promise<void> {
        const formattedAddress = `*${this.enteredAddress!.slice(0, 4)}*${this.enteredAddress!.slice(4, 7)}...${this.enteredAddress!.slice(-7, -4)}*${this.enteredAddress!.slice(-4)}*`;
        const confirmationMessage = `${this.transferAmount} ${this.assetId.symbol} -> ${formattedAddress}`;

        await this.handleMessageResponse(async () => {
            this.step = "CONFIRMATION";
            return await this.ctx.reply(confirmationMessage, {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(Strings.BUTTON_CANCEL, Actions.CANCEL),
                        Markup.button.callback(Strings.BUTTON_ACCEPT, Actions.ACCEPT),
                    ],
                ]),
            });
        });
    }

    isFinished(): boolean {
        return this.step === "COMPLETED";
    }
}
