import {DexInterface} from "./dex.interface";
import {MiraDex} from "./mira-dex/mira_dex";

import {
    AssetId,
    BN,
    Provider,
    WalletUnlocked
} from "fuels";

import {retry} from "../utils/call_helper";
import {TokenInfo} from "./model";
import {getVerifiedAssets} from "../fuel/asset/verified_assets_provider";

export class DexClient {
    private wallet: WalletUnlocked
    private dexArray: DexInterface[] = [];

    constructor(provider: Provider, wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.dexArray.push(new MiraDex(provider, wallet));
    }

    async calculateSwapAmount(assetIn: string, assetOut: string, amount: number): Promise<number> {
        const assetInId = {bits: assetIn};
        const assetOutId = {bits: assetOut};

        const tokenInfoOut = await this.getTokenInfo(assetOut);
        const decimalsOut = tokenInfoOut.decimals;

        const amountBN = await this.getTokenAmountBN(assetIn, amount);
        const result = await this.getBestRate(assetInId, assetOutId, amountBN);

        const maxAmount = result.maxAmount.toNumber();

        return maxAmount / Math.pow(10, decimalsOut);
    }

    async getBalance(asset: string): Promise<number> {
        const amountBN = await this.wallet.getBalance(asset);
        return await this.getTokenAmount(asset, amountBN);
    }

    async getBalances(): Promise<Array<[string, string]>> {
        const balances = await this.wallet.getBalances();
        const balancePairs: Array<[string, string]> = [];

        for (const balance of balances.balances) {
            try {
                const tokenInfo = await this.getTokenInfo(balance.assetId);
                const readableAmount =
                    parseFloat(balance.amount.toString()) / Math.pow(10, tokenInfo.decimals);

                balancePairs.push([tokenInfo.symbol.toString(), readableAmount.toFixed(tokenInfo.decimals)]);
            } catch (error) {
                console.info(`Failed to fetch token info for asset ID ${balance.assetId}: ${error.message}`);
                const readableAmount = parseFloat(balance.amount.toString());
                balancePairs.push([balance.assetId, readableAmount.toString()]);
            }
        }

        return balancePairs;
    }

    async getTokenInfo(asset: string): Promise<TokenInfo> {
        const verifiedAssets = await getVerifiedAssets();
        const matchedAsset = verifiedAssets.find((verified) => verified.assetId === asset);

        if (matchedAsset) {
            return {
                name: matchedAsset.name,
                symbol: matchedAsset.symbol,
                decimals: matchedAsset.decimals,
            };
        }


        for (const dex of this.dexArray) {
            try {
                const assetId = {bits: asset};
                return await dex.getTokenInfo(assetId);

            } catch (error) {
                console.info(`Failed to get token information from DEX: ${error.message}`);
            }
        }

        throw new Error(`Token information not found for asset ID: ${asset}`);
    }

    async swap(assetIn: string, assetOut: string, amount: number): Promise<boolean> {
        const assetInId = {bits: assetIn};
        const assetOutId = {bits: assetOut};

        const amountBN = await this.getTokenAmountBN(assetIn, amount);

        const {bestDex} = await this.getBestRate(assetInId, assetOutId, amountBN);

        const balanceBefore = await this.wallet.getBalance(assetOut);
        try {
            const result = await bestDex.swap(assetInId, assetOutId, amountBN)
            return result != null
        } catch (error) {
            const balanceAfter = await this.wallet.getBalance(assetOut);
            //Safe check to prevent Error in Success result
            if (balanceAfter != null && balanceBefore != null && !balanceAfter.eq(balanceBefore)) {
                return true
            } else {
                throw new Error(`Swap failed: ${error.message}`);
            }
        }
    }

    private async getBestRate(
        assetIn: AssetId,
        assetOut: AssetId,
        amount: BN
    ): Promise<{ bestDex: DexInterface; maxAmount: BN }> {
        const dexResults = await Promise.all(
            this.dexArray.map(async (dex) => {
                const swapAmount = await retry(async () => dex.getSwapAmount(assetIn, assetOut, amount));
                return {dex, swapAmount: swapAmount};
            })
        );

        const bestResult = dexResults.reduce((best, current) =>
            current.swapAmount.gt(best.swapAmount) ? current : best
        );

        return {
            bestDex: bestResult.dex,
            maxAmount: bestResult.swapAmount,
        };
    }

    private async getTokenAmount(asset: string, amount: BN): Promise<number> {
        const tokenInfo = await this.getTokenInfo(asset);
        return parseFloat(amount.toString()) / Math.pow(10, tokenInfo.decimals);
    }

    private async getTokenAmountBN(asset: string, amount: number): Promise<BN> {
        const tokenInfo = await retry(async () => this.getTokenInfo(asset));
        const decimals = tokenInfo.decimals;

        return new BN(amount * Math.pow(10, decimals));
    }
}