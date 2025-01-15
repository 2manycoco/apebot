import {AssetId, BN, Provider, TransactionResult, WalletUnlocked} from "fuels";
import {DexInterface} from "../dex.interface";
import {buildPoolId, getLPAssetId, MiraAmm, ReadonlyMiraAmm} from "mira-dex-ts";
import {futureDeadline} from "../../fuel/functions";
import {TokenInfo} from "../model";
import {retry} from "../../utils/call_helper";
import {CONTRACTS} from "../../fuel/asset/contracts";

const MIRA_POOL_TOKEN_SYMBOL = "MIRA-LP"

export class MiraDex implements DexInterface {
    private wallet: WalletUnlocked;
    private provider: Provider;
    private miraAmm: MiraAmm;
    private readonlyMiraAmm: ReadonlyMiraAmm;
    private contractId: string

    constructor(wallet: WalletUnlocked, provider: Provider, contractId: string) {
        this.wallet = wallet;
        this.provider = provider;
        this.miraAmm = new MiraAmm(wallet, contractId);
        this.readonlyMiraAmm = new ReadonlyMiraAmm(provider, contractId);
        this.contractId = contractId;
    }

    async getTokenInfo(assetId: AssetId): Promise<TokenInfo> {
        const poolId = buildPoolId(CONTRACTS.ASSET_ETH, assetId, false);
        const lpAssetId = getLPAssetId(this.contractId, poolId);
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
            name: assetInfo.name || "Unknown",
            symbol,
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
}