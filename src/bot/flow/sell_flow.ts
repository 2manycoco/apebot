import { Flow } from "./flow";
import { Context, Markup } from "telegraf";
import { Actions, ActionValues, TemplateActions, TemplateActionValues } from "../actions";
import { FlowId, FlowValues } from "./flow_ids";
import { formatMessage, Strings } from "../resources/strings";
import { formatTokenNumber, withProgress } from "../help_functions";
import { DexClient } from "../../dex/dex_client";
import { CONTRACTS, TRADE_ASSET } from "../../fuel/asset/contracts";
import { replyConfirmMessage } from "../session_message_builder";

export class SellFlow extends Flow {
    private step: "SELECT_ASSET" | "INPUT_PERCENTAGE" | "CONFIRMATION" | "COMPLETED" = "SELECT_ASSET";
    private userDexClient: DexClient;

    private assetsList: Array<{ assetId: string; symbol: string; balance: number; priceInUsdc: string }> = [];
    private asset: { assetId: string; symbol: string; balance: number; priceInUsdc: string } = null;
    private amountToSell: number;
    private percentageToSell: number | null = null;

    private tradeAsset = CONTRACTS.ASSET_ETH;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        private symbol: string | null = null,
        private percentage: number | null = null,
        onCompleteCallback?: (flowId: string) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
    }

    getFlowId(): FlowValues {
        return FlowId.SELL_FLOW;
    }

    public async start(): Promise<void> {
        if (this.symbol) {
            await this.handleSymbolSelection();
        } else {
            await this.displayAssetSelection();
        }
    }

    private async handleSymbolSelection(): Promise<void> {
        const balances = await this.userDexClient.getBalances();
        const selectedAsset = balances
            .filter(([assetId]) => assetId !== this.tradeAsset.bits)
            .map(([assetId, symbol, amount]) => ({
                assetId,
                symbol,
                balance: parseFloat(amount),
            }))
            .find((asset) => asset.symbol === this.symbol);

        if (!selectedAsset) {
            await this.ctx.reply(Strings.SELL_NO_ASSETS_TEXT, { parse_mode: "Markdown" });
            this.step = "COMPLETED";
            return;
        }

        this.asset = {
            ...selectedAsset,
            priceInUsdc: "?",
        };

        if (this.percentage !== null) {
            if (this.percentage <= 0 || this.percentage > 100) {
                await this.ctx.reply(Strings.SELL_PERCENTAGE_ERROR, { parse_mode: "Markdown" });
                this.step = "COMPLETED";
                return;
            }
            this.percentageToSell = this.percentage;
            await this.calculateAndConfirmSell();
        } else {
            await this.promptPercentageSelection();
        }
    }

    private async displayAssetSelection(): Promise<void> {
        const result = await withProgress(this.ctx, async () => {
            const balances = await this.userDexClient.getBalances();
            const nonEthBalances = balances.filter(([assetId]) => assetId !== this.tradeAsset.bits);

            if (nonEthBalances.length === 0) {
                await this.ctx.reply(Strings.SELL_NO_ASSETS_TEXT, { parse_mode: "Markdown" });
                this.step = "COMPLETED";
                return Promise.resolve(false);
            }

            this.assetsList = await Promise.all(
                nonEthBalances.map(async ([assetId, symbol, amount]) => {
                    const balance = parseFloat(amount);
                    let priceInUsdc: string | null = null;
                    try {
                        if (CONTRACTS.ASSET_USDC.bits != assetId) {
                            const usdcRate = await this.userDexClient.getRate(assetId, CONTRACTS.ASSET_USDC.bits);
                            priceInUsdc = formatTokenNumber(balance * usdcRate);
                        } else {
                            priceInUsdc = "1"
                        }
                    } catch (e) {
                        priceInUsdc = "?";
                    }

                    return {
                        assetId,
                        symbol,
                        balance,
                        priceInUsdc,
                    };
                })
            );

            const balancesText = this.assetsList
                .map(
                    (asset) =>
                        `*${asset.symbol}*: ${formatTokenNumber(asset.balance)} (${asset.priceInUsdc} ${CONTRACTS.ASSET_USDC.symbol})`
                )
                .join("\n");

            const balanceButtons = this.assetsList.map((asset) =>
                Markup.button.callback(asset.symbol, TemplateActions.SELL(asset.symbol))
            );

            const keyboard = Markup.inlineKeyboard(
                balanceButtons.reduce((rows, button, index) => {
                    if (index % 3 === 0) rows.push([]);
                    rows[rows.length - 1].push(button);
                    return rows;
                }, [] as Array<Array<ReturnType<typeof Markup.button.callback>>>)
            );

            await this.ctx.reply(formatMessage(Strings.SELL_START_TEXT_ASSET, balancesText), { parse_mode: "Markdown", ...keyboard });

            return Promise.resolve(true);
        });

        if (!result) return;
    }

    private async promptPercentageSelection(): Promise<void> {
        const message = formatMessage(
            Strings.SELL_ENTER_PERCENTAGE,
            this.asset.symbol
        );

        this.step = "INPUT_PERCENTAGE";
        await this.handleMessageResponse(async () => {
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
        if (this.step === "INPUT_PERCENTAGE") {
            const percentageMap = {
                [Actions.PERCENT_25]: 25,
                [Actions.PERCENT_50]: 50,
                [Actions.PERCENT_100]: 100,
            };

            if (percentageMap[action] !== undefined) {
                this.percentageToSell = percentageMap[action];
                await this.calculateAndConfirmSell();
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
                    const slippage = await this.userManager.getSlippage();
                    await this.userDexClient.swap(this.asset.assetId, CONTRACTS.ASSET_ETH.bits, this.amountToSell!, slippage);
                    await this.ctx.reply(Strings.SELL_SUCCESS, { parse_mode: "Markdown" });
                    this.step = "COMPLETED";
                });
                return true;
            }
        }

        return false;
    }

    public async handleTemplateActionInternal(action: TemplateActionValues): Promise<boolean> {
        if (this.step !== "SELECT_ASSET") {
            await this.ctx.reply(Strings.SELL_SOMETHING_WRONG_TEXT, {parse_mode: "Markdown"});
            return false;
        }

        if (action.type !== "SELL") {
            await this.ctx.reply(Strings.SELL_SOMETHING_WRONG_TEXT, {parse_mode: "Markdown"});
            return false;
        }

        const selectedAsset = this.assetsList.find(asset => asset.symbol === action.symbol);
        if (!selectedAsset) {
            await this.ctx.reply(Strings.SELL_SELECT_ASSET_ERROR, {parse_mode: "Markdown"});
            return false;
        }

        this.asset = selectedAsset;

        const message = formatMessage(
            Strings.SELL_ENTER_PERCENTAGE,
            this.asset.symbol
        );

        this.step = "INPUT_PERCENTAGE";
        await this.handleMessageResponse(async () => {
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

        return true;
    }

    public async handleMessageInternal(message: string): Promise<boolean> {
        if (this.step === "INPUT_PERCENTAGE") {
            const percentage = parseFloat(message);
            if (isNaN(percentage) || percentage < 1 || percentage > 100) {
                await this.ctx.reply(Strings.SELL_PERCENTAGE_ERROR, { parse_mode: "Markdown" });
                return false;
            }

            this.percentageToSell = percentage;
            await this.calculateAndConfirmSell();
            return true;
        }

        return false;
    }

    private async calculateAndConfirmSell(): Promise<void> {
        const confirmationMessage = await withProgress(this.ctx, async () => {
            this.amountToSell = (this.asset.balance * this.percentageToSell!) / 100;
            const expectedEthAmount = await this.userDexClient.calculateSwapAmount(this.asset.assetId, TRADE_ASSET.bits, this.amountToSell);

            return formatMessage(
                Strings.SELL_CONFIRMATION_TEXT,
                formatTokenNumber(this.amountToSell),
                this.asset.symbol,
                formatTokenNumber(expectedEthAmount),
                TRADE_ASSET.symbol
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
