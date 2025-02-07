import {Context} from "telegraf";
import {Flow} from "./flow";
import {FlowId, FlowValues} from "./flow_ids";
import {Position, Transaction} from "../../database/entities";
import {getPositionRepository} from "../../database/position_repository";
import {DexClient} from "../../dex/dex_client";
import {Markup} from "telegraf";
import {Actions, ActionValues, TemplateActions, TemplateActionValues} from "../actions";
import {formatPercentage, formatTokenNumber, withProgress} from "../help_functions";
import {formatMessage, Strings} from "../resources/strings";
import {CONTRACTS} from "../../fuel/asset/contracts";

interface Pagination {
    offset: number;
    limit: number;
}

interface MessageMap {
    generatedId: number;
    messageId: number;
    positionId: string;
    assetSymbol: string;
}

interface PositionData {
    balance: number;
    balanceUsdc: number;
    balanceTrade: number;
    pnl: number;
    pnlUsdc: number;
    pnlPercentage: string;
}

const PAGE_LIMIT = 2

export class PositionsFlow extends Flow {
    private positionRepository = getPositionRepository();
    private userDexClient: DexClient;
    private pagination: Pagination = {offset: 0, limit: PAGE_LIMIT};
    private messageMap: MessageMap[] = [];
    private showMoreMessageId?: number;

    private generatedId = 0

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        onCompleteCallback?: (flowId: string, successful: Boolean) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
    }

    getFlowId(): FlowValues {
        return FlowId.POSITIONS_FLOW;
    }

    async start(): Promise<void> {
        await this.displayPositions();
    }

    private async displayPositions(): Promise<void> {
        const positions = await this.positionRepository.getPositionsByUser(this.userId);
        const totalPositions = positions.length;
        const paginatedPositions = positions.slice(this.pagination.offset, this.pagination.offset + this.pagination.limit);

        let shownCount = 0;
        for (const position of paginatedPositions) {
            const id = ++this.generatedId;
            await withProgress(this.ctx, async () => {
                try {
                    const message = await this.generatePositionMessage(position);
                    const tokenInfoOut = await this.userDexClient.getTokenInfo(position.transaction.assetIdOut)
                    const buttons = this.generatePositionButtons(tokenInfoOut.symbol, id);

                    await this.handleMessageResponse(async () => {
                        const sentMessage = await this.ctx.reply(message, {
                            parse_mode: "Markdown",
                            ...buttons
                        });

                        this.messageMap.push({
                            generatedId: id,
                            messageId: sentMessage.message_id,
                            positionId: position.positionId,
                            assetSymbol: tokenInfoOut.symbol
                        });
                        shownCount++;

                        return sentMessage;
                    })
                } catch (e) {
                    console.error(e);
                    //this.deletePosition(position.positionId)
                }
            });
        }

        if (shownCount === 0) {
            if (this.pagination.offset == 0) {
                await this.ctx.reply(Strings.POSITIONS_NO_POSITIONS_TEXT);
            } else {
                await this.ctx.reply(Strings.POSITIONS_NO_MORE_POSITIONS_TEXT);
            }
            return;
        }

        const remainingPositions = totalPositions - (this.pagination.offset + this.pagination.limit);
        if (remainingPositions > 0) {
            await this.handleMessageResponse(async () => {
                const sentMessage = await this.ctx.reply(
                    formatMessage(Strings.POSITIONS_MORE_TEXT, remainingPositions),
                    Markup.inlineKeyboard([
                        Markup.button.callback(Strings.BUTTON_MORE, Actions.SHOW_MORE),
                    ])
                );
                this.showMoreMessageId = sentMessage.message_id

                return sentMessage;
            })
        }

        this.pagination.offset += this.pagination.limit;
    }

    private async generatePositionMessage(position: Position): Promise<string> {

        const tokenInfoIn = await this.userDexClient.getTokenInfo(position.transaction.assetIdIn)
        const tokenInfoOut = await this.userDexClient.getTokenInfo(position.transaction.assetIdOut)
        const transactions = await this.positionRepository.getTransactions(position.positionId);
        const pnl = await this.calculatePNL(position, transactions);

        return (
            `*${tokenInfoOut.symbol}*\n` +
            `Balance:  ${formatTokenNumber(pnl.balanceTrade)} ${tokenInfoIn.symbol}  _(${formatTokenNumber(pnl.balanceUsdc)}$)_\n\n` +
            `*PnL:*  ${this.formatPNL(pnl.pnl, pnl.pnlPercentage, tokenInfoIn.symbol)}`
        );
    }

    private async calculatePNL(position: Position, transactions: Transaction[]): Promise<PositionData> {
        const tradeAssetId = position.transaction.assetIdIn;
        const positionAssetId = position.transaction.assetIdOut;

        let spent = 0;
        let gained = 0;
        let remaining = 0;

        for (const tx of transactions) {
            if (tx.assetIdIn === tradeAssetId) {
                spent += Number(tx.amountIn);
            } else if (tx.assetIdOut === tradeAssetId) {
                gained += Number(tx.amountOut);
            }

            if (tx.assetIdOut === positionAssetId) {
                remaining += Number(tx.amountOut);
            } else if (tx.assetIdIn === positionAssetId) {
                remaining -= Number(tx.amountIn);
            }
        }

        if (remaining <= 0 || spent == 0) {
            throw Error("Position is broken")
        }

        const positionTradeRate = await this.userDexClient.getRate(positionAssetId, tradeAssetId);
        const positionTradeBalance = remaining * positionTradeRate;

        const positionTradeUsdcRate = await this.userDexClient.getRate(tradeAssetId, CONTRACTS.ASSET_USDC.bits);
        const positionBalanceUsdc = positionTradeBalance * positionTradeUsdcRate;

        const pnl = gained + positionTradeBalance - spent;

        const tradeToUsdcRate = await this.userDexClient.getRate(tradeAssetId, CONTRACTS.ASSET_USDC.bits);
        const pnlUsdc = pnl * tradeToUsdcRate;

        const pnlPercentage = formatPercentage(((pnl / spent) * 100));

        return {
            balance: remaining,
            balanceUsdc: positionBalanceUsdc,
            balanceTrade: positionTradeBalance,
            pnl: pnl,
            pnlUsdc: pnlUsdc,
            pnlPercentage: pnlPercentage
        };
    }

    private formatPNL(pnl: number, pnlPercentage: string, symbol: string): string {
        const isPositive = pnl >= 0;
        const emoji = isPositive ? "🟢" : "🔴";
        return `${formatTokenNumber(pnl)} ${symbol}  _(${pnlPercentage}%)_ ${emoji}`;
    }

    private generatePositionButtons(symbol: string, generatedId: number) {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(Strings.PERCENT_25, TemplateActions.SELL(symbol, 25)),
                Markup.button.callback(Strings.PERCENT_50, TemplateActions.SELL(symbol, 50)),
                Markup.button.callback(Strings.PERCENT_100, TemplateActions.SELL(symbol, 100)),
            ],
            [
                Markup.button.callback(Strings.BUTTON_CUSTOM, TemplateActions.SELL(symbol)),
                Markup.button.callback(Strings.BUTTON_REFRESH, TemplateActions.REFRESH(generatedId)),
                Markup.button.callback(Strings.BUTTON_HIDE, TemplateActions.HIDE(generatedId)),
            ],
        ]);
    }

    async handleActionInternal(action: ActionValues): Promise<boolean> {
        if (action === Actions.SHOW_MORE) {
            if (this.showMoreMessageId) {
                try {
                    await this.ctx.telegram.deleteMessage(this.ctx.chat.id, this.showMoreMessageId);
                } catch (e) {
                }
                this.showMoreMessageId = undefined;
            }
            await this.displayPositions();
            return true;
        }

        if (action === Actions.LOADING) {
            return true;
        }

        return false;
    }

    async handleTemplateActionInternal(action: TemplateActionValues): Promise<boolean> {
        const {type, symbol, id} = action;

        if (type === "REFRESH" && id) {
            const mapEntry = this.messageMap.find((entry) => entry.generatedId === id);

            if (mapEntry) {
                const position = await this.positionRepository.getPosition(mapEntry.positionId);

                if (position) {
                    await this.ctx.telegram.editMessageReplyMarkup(
                        this.ctx.chat.id,
                        mapEntry.messageId,
                        undefined,
                        Markup.inlineKeyboard([
                            [Markup.button.callback(Strings.BUTTON_LOADING, Actions.LOADING)]
                        ]).reply_markup
                    );

                    const message = await this.generatePositionMessage(position);

                    await this.ctx.telegram.editMessageText(
                        this.ctx.chat.id,
                        mapEntry.messageId,
                        undefined,
                        message + "\n_Refreshed_",
                        {
                            ...this.generatePositionButtons(mapEntry.assetSymbol, id),
                            parse_mode: "Markdown",
                        }
                    );
                }
            }
            return true;
        }

        if (type === "HIDE" && id) {
            const mapEntry = this.messageMap.find((entry) => entry.generatedId === id);

            if (mapEntry) {
                this.deletePosition(mapEntry.positionId);
                await this.ctx.telegram.deleteMessage(this.ctx.chat.id, mapEntry.messageId);
                this.messageMap = this.messageMap.filter((entry) => entry.generatedId !== id);
            }
            return true;
        }

        return false;
    }

    private async deletePosition(positionId: string) {
        try {
            await this.positionRepository.deletePosition(positionId);
        } catch (error) {
            console.error(`Failed to delete position with ID ${positionId}:`, error);
        }
    }

    async handleMessageInternal(message: string): Promise<boolean> {
        return false;
    }

    protected isFinished(): boolean {
        return false;
    }
}
