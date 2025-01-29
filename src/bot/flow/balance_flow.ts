import {Context} from "telegraf";
import {Flow} from "./flow";
import {FlowId, FlowValues} from "./flow_ids";
import {DexClient} from "../../dex/dex_client";
import {withProgress} from "../help_functions";
import {replyBalance} from "../session_message_builder";
import {TRADE_ASSET} from "../../fuel/asset/contracts";

export class BalanceFlow extends Flow {
    private userDexClient: DexClient;

    constructor(
        ctx: Context,
        userId: number,
        userDexClient: DexClient,
        onCompleteCallback?: (flowId: string) => void
    ) {
        super(ctx, userId, onCompleteCallback);
        this.userDexClient = userDexClient;
    }

    getFlowId(): FlowValues {
        return FlowId.BALANCE_FLOW;
    }

    async start(): Promise<void> {
        await this.showBalance();
    }

    private async showBalance(): Promise<void> {
        let totalBalance = 0;
        let balances: Array<[string, string, string, boolean]> = [];

        await withProgress(this.ctx, async () => {
            balances = await this.userDexClient.getBalances();
            for (const [assetId, symbol, amount, isBounded] of balances) {
                const balanceAmount = parseFloat(amount);
                if (symbol === TRADE_ASSET.symbol) {
                    totalBalance += balanceAmount;
                } else {
                    try {
                        if(isBounded) {
                            const rate = await this.userDexClient.getRate(assetId, TRADE_ASSET.bits);
                            const equivalent = balanceAmount * rate;
                            totalBalance += equivalent;
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch rate for asset ${symbol}: ${error.message}`);
                    }
                }
            }
        });

        await replyBalance(this.ctx, balances, totalBalance, TRADE_ASSET.symbol);
    }

    async handleActionInternal(action: string): Promise<boolean> {
        return false;
    }

    async handleMessageInternal(message: string): Promise<boolean> {
        return false;
    }

    protected isFinished(): boolean {
        return true;
    }
}
