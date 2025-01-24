import {
    AssetId,
    BN,
    Provider,
    TransactionResult,
    WalletUnlocked
} from "fuels";
import {DexInterface} from "../dex.interface";
import {buildPoolId, getLPAssetId, MiraAmm, PoolId, ReadonlyMiraAmm} from "mira-dex-ts";
import {applySlippageBN, futureDeadline} from "../../fuel/functions";
import {TokenInfo} from "../model";
import {retry} from "../../utils/call_helper";
import {CONTRACTS} from "../../fuel/asset/contracts";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const MIRA_POOL_TOKEN_SYMBOL = "MIRA-LP"
const POOL_NOT_FOUND_ERROR = "Pool not found";
const contractId = process.env.MIRA_CONTRACT_ID;

export class MiraDex implements DexInterface {
    private readonly wallet: WalletUnlocked;
    private readonly provider: Provider;
    private readonly miraAmm: MiraAmm;
    private readonly readonlyMiraAmm: ReadonlyMiraAmm;

    constructor(provider: Provider, wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.provider = provider;
        this.miraAmm = new MiraAmm(wallet, contractId);
        this.readonlyMiraAmm = new ReadonlyMiraAmm(provider, contractId);
    }

    async getTokenInfo(assetId: AssetId): Promise<TokenInfo> {
        const poolId = buildPoolId(CONTRACTS.ASSET_ETH, assetId, false);
        const lpAssetId = getLPAssetId(contractId, poolId);
        const assetInfo = await retry(
            async () => await this.readonlyMiraAmm.lpAssetInfo(lpAssetId)
        );

        if (!assetInfo) {
            throw new Error(`Token info not found for asset ID: ${assetId.bits}`);
        }

        // Handle 'MIRA-LP' case
        let symbol = assetInfo.symbol || "Unknown";
        if (symbol === MIRA_POOL_TOKEN_SYMBOL) {
            // Extract the first part of the name (before the '-') using regex
            const match = assetInfo.name.match(/^([^-]+)-/);
            symbol = match ? match[1].trim() : assetInfo.name;
        }

        return {
            assetId: assetId.bits,
            name: assetInfo.name || "Unknown",
            symbol: symbol,
            decimals: assetInfo.decimals || 0,
        };
    }

    async getSwapAmount(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<BN> {
        return this.handlePoolNotFound(
            async (pools) => this.readonlyMiraAmm.previewSwapExactInput(assetIn, amount, pools),
            assetIn,
            assetOut
        ).then(([_, amountOut]) => {
            if (!amountOut || !(amountOut instanceof BN) || amountOut.lte(new BN(0))) {
                throw new Error(`Invalid swap amount returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}, amount: ${amount.toString()}`);
            }
            return amountOut;
        });
    }

    async swap(assetIn: AssetId, assetOut: AssetId, amount: BN, slippage: number): Promise<TransactionResult> {
        const amountOutMin = await this.getSwapAmount(assetIn, assetOut, amount);
        const amountOutMinWithSlippage = applySlippageBN(amountOutMin, slippage);

        if (amountOutMinWithSlippage.lte(new BN(0))) {
            throw new Error('Adjusted amountOutMin is less than or equal to 0 after subtracting commission.');
        }

        const deadline = await futureDeadline(this.provider);
        const txParams = {
            gasLimit: 999999,
            maxFee: 999999,
        };

        const txRequest = await this.handlePoolNotFound(
            async (pools) => this.miraAmm.swapExactInput(
                amount,
                assetIn,
                amountOutMinWithSlippage,
                pools,
                deadline,
                txParams
            ),
            assetIn,
            assetOut
        );

        const txCost = await this.wallet.getTransactionCost(txRequest);
        txRequest.gasLimit = txCost.gasUsed.add(new BN(10000));
        txRequest.maxFee = txCost.maxFee;
        await this.wallet.fund(txRequest, txCost);

        const tx = await this.wallet.sendTransaction(txRequest);

        return await retry(async () => tx.waitForResult());
    }

    async getRate(assetIn: AssetId, assetOut: AssetId): Promise<number> {
        return this.handlePoolNotFound(
            async (pools) => this.readonlyMiraAmm.getCurrentRate(assetIn, pools),
            assetIn,
            assetOut
        ).then(([rate, assetInDecimals, assetOutDecimals]) => {
            if (rate <= 0) {
                throw new Error(`Invalid rate returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}`);
            }

            const scaleFactor = Math.pow(10, assetOutDecimals - assetInDecimals);
            return rate * scaleFactor;
        });
    }

    private createEthRoute(assetIn: AssetId, assetOut: AssetId): PoolId[] {
        const poolInEthId = buildPoolId(assetIn, CONTRACTS.ASSET_ETH, false);
        const poolOutEthId = buildPoolId(assetOut, CONTRACTS.ASSET_ETH, false);
        return [poolInEthId, poolOutEthId]
    }

    private async handlePoolNotFound<T>(
        fn: (pools: PoolId[]) => Promise<T>,
        assetIn: AssetId,
        assetOut: AssetId
    ): Promise<T> {
        const directPool = [buildPoolId(assetIn, assetOut, false)];
        try {
            return await retry(() => fn(directPool));
        } catch (error: any) {
            if (typeof error.message === "string" && error.message.includes(POOL_NOT_FOUND_ERROR)) {
                const ethRoute = this.createEthRoute(assetIn, assetOut);
                return await retry(() => fn(ethRoute));
            }
            throw error;
        }
    }

}