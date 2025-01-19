import {AssetId, BN, Provider, TransactionResult, WalletUnlocked} from "fuels";
import {DexInterface} from "../dex.interface";
import {buildPoolId, getLPAssetId, MiraAmm, ReadonlyMiraAmm} from "mira-dex-ts";
import {futureDeadline} from "../../fuel/functions";
import {TokenInfo} from "../model";
import {retry} from "../../utils/call_helper";
import {CONTRACTS} from "../../fuel/asset/contracts";
import dotenv from "dotenv";

dotenv.config();

const MIRA_POOL_TOKEN_SYMBOL = "MIRA-LP"
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
        const poolId = buildPoolId(assetIn, assetOut, false);
        const result = await retry(
            async () => this.readonlyMiraAmm.previewSwapExactInput(assetIn, amount, [poolId])
        );

        if (!result) {
            throw new Error(`Swap amount request failed`);
        }

        const amountOut = result[1]

        if (!amountOut || !(amountOut instanceof BN) || amountOut.lte(new BN(0))) {
            throw new Error(`Invalid swap amount returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}, amount: ${amount.toString()}`);
        }

        return amountOut
    }

    async swap(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<TransactionResult> {
        const amountOutMin = await this.getSwapAmount(assetIn, assetOut, amount);
        const deadline = await futureDeadline(this.provider);

        const poolId = buildPoolId(assetIn, assetOut, false);
        const txParams = {
            gasLimit: 999999,
            maxFee: 999999,
        };

        const txRequest = await this.miraAmm.swapExactInput(amount, assetIn, amountOutMin, [poolId], deadline, txParams);

        const txCost = await this.wallet.getTransactionCost(txRequest);
        txRequest.gasLimit = txCost.gasUsed;
        txRequest.maxFee = txCost.maxFee;
        await this.wallet.fund(txRequest, txCost);

        const tx = await this.wallet.sendTransaction(txRequest);
        return await retry(
            async () => tx.waitForResult()
        );
    }

    async getRate(assetIn: AssetId, assetOut: AssetId): Promise<number> {
        const poolId = buildPoolId(assetIn, assetOut, false);
        const result = await retry(
            async () => await this.readonlyMiraAmm.getCurrentRate(assetIn, [poolId])
        );

        if (!result) {
            throw new Error(`Rate request failed for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}`);
        }

        const [rate, assetInDecimals, assetOutDecimals] = result;

        if (rate <= 0) {
            throw new Error(`Invalid rate returned for assetIn: ${assetIn.bits}, assetOut: ${assetOut.bits}`);
        }

        return rate;
    }
}