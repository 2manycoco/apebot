import {DexInterface} from "./dex.interface";
import {MiraDex} from "./mira-dex/mira_dex";

import {AssetId, BN, Provider, WalletUnlocked} from "fuels";

import {retry} from "../utils/call_helper";
import {TokenInfo} from "./model";
import {getVerifiedAssets} from "../fuel/asset/verified_assets_provider";
import {MIN_OPERATION_VALUE} from "../fuel/constants";
import {FuelUpDex} from "./fuelup-fun/fuelup_dex";
import {shortAddress} from "../bot/help_functions";
import {DieselDex} from "./diesel-dex/diesel_dex";

const hideBalanceAmount = new BN(1)

export class DexClient {
    private wallet: WalletUnlocked
    private boundedDexArray: DexInterface[] = [];
    private unboundedDexArray: DexInterface[] = [];
    private static tokenInfoCache: Map<string, TokenInfo> = new Map();
    private static notSupportedAssets: Set<string> = new Set();

    constructor(wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.boundedDexArray.push(new MiraDex(wallet));
        this.boundedDexArray.push(new DieselDex(wallet));
        this.unboundedDexArray.push(new FuelUpDex(wallet));
    }

    async getBalance(asset: string): Promise<[number, BN]> {
        const amountBN = await retry(
            async () => await this.wallet.getBalance(asset)
        );
        const amount = await this.getTokenAmount(asset, amountBN)
        return [amount, amountBN];
    }

    async getBalances(): Promise<Array<[string, string, string, boolean]>> {
        const balances = await retry(
            async () => await this.wallet.getBalances()
        );
        const balancePairs: Array<[string, string, string, boolean]> = [];

        for (const balance of balances.balances) {
            try {
                if (!balance.amount.eq(hideBalanceAmount)) {
                    const tokenInfo = await this.getTokenInfo(balance.assetId);
                    const readableAmount =
                        parseFloat(balance.amount.toString()) / Math.pow(10, tokenInfo.decimals);

                    balancePairs.push([balance.assetId, tokenInfo.symbol.toString(), readableAmount.toFixed(tokenInfo.decimals), tokenInfo.isBounded]);
                }
            } catch (error) {
                console.info(`Failed to fetch token info for asset ID ${balance.assetId}: ${error.message}`);
                //Unsupported assets
                /* const readableAmount = parseFloat(balance.amount.toString());
                 balancePairs.push([balance.assetId, shortAddress(balance.assetId, false), readableAmount.toString(), false]);*/
            }
        }

        return balancePairs;
    }

    async getTokenInfo(asset: string): Promise<TokenInfo> {
        const verifiedAssets = await getVerifiedAssets();
        const matchedAsset = verifiedAssets.find((verified) => verified.assetId === asset);

        if (matchedAsset) {
            return {
                assetId: matchedAsset.assetId,
                name: matchedAsset.name,
                symbol: matchedAsset.symbol,
                decimals: matchedAsset.decimals,
                isBounded: true,
                isFuelTrade: true
            };
        }

        if (DexClient.tokenInfoCache.has(asset)) {
            return DexClient.tokenInfoCache.get(asset)!;
        }

        if (DexClient.notSupportedAssets.has(asset)) {
            throw new Error(`Token info not found for asset ID: ${asset}`);
        }

        const errors: string[] = [];
        for (const dex of [...this.unboundedDexArray, ...this.boundedDexArray]) {
            try {
                const assetId = {bits: asset};
                const tokenInfo = await dex.getTokenInfo(assetId);
                DexClient.tokenInfoCache.set(asset, tokenInfo);
                return tokenInfo

            } catch (error) {
                console.info(`Failed to get token information from DEX: ${error.message}`);
                errors.push(error.message);
            }
        }

        const errorTexts = ["Could not retrieve token info", "Token info not found for asset ID"];
        const allMatch = errors.every(msg => errorTexts.some(text => msg.includes(text)));
        if (allMatch) {
            DexClient.notSupportedAssets.add(asset);
        }

        throw new Error(`Token information not found for asset ID: ${asset}`);
    }

    // Get the rate of `assetIn` in terms of `assetOut`
    // The rate represents the value of `assetIn` relative to `assetOut`
    async getRate(assetIn: string, assetOut: string): Promise<number> {
        const tokenInfoIn = await this.getTokenInfo(assetIn);
        const assetInId = {bits: assetIn};
        const assetOutId = {bits: assetOut};

        const dexArray = tokenInfoIn.isBounded ? this.boundedDexArray : this.unboundedDexArray;

        for (const dex of dexArray) {
            try {
                return await dex.getRate(assetInId, assetOutId);
            } catch (error) {
                console.info(`Failed to fetch rate from DEX: ${error.message}`);
            }
        }

        throw new Error(`Unable to fetch rate for assetIn: ${assetIn}, assetOut: ${assetOut}`);
    }

    async calculateSwapAmount(assetIn: string, assetOut: string, amount: number): Promise<number> {
        const tokenInfoIn = await this.getTokenInfo(assetIn);
        const assetInId = {bits: assetIn};
        const assetOutId = {bits: assetOut};

        const tokenInfoOut = await this.getTokenInfo(assetOut);
        const decimalsOut = tokenInfoOut.decimals;

        const amountBN = await this.getTokenAmountBN(assetIn, amount);
        const result = await this.getBestRate(assetInId, assetOutId, amountBN, tokenInfoIn.isBounded && tokenInfoOut.isBounded);

        const maxAmount = result.maxAmount.toNumber();

        return maxAmount / Math.pow(10, decimalsOut);
    }

    async swap(assetIn: string, assetOut: string, amount: number, slippage: number): Promise<boolean> {
        const tokenInfoIn = await this.getTokenInfo(assetIn);
        const tokenInfoOut = await this.getTokenInfo(assetOut);
        const assetInId = {bits: assetIn};
        const assetOutId = {bits: assetOut};

        const amountBN = await this.getTokenAmountBN(assetIn, amount);

        const {bestDex} = await this.getBestRate(assetInId, assetOutId, amountBN, tokenInfoIn.isBounded && tokenInfoOut.isBounded);

        const balanceBefore = await this.wallet.getBalance(assetOut);
        try {
            const result = await bestDex.swap(assetInId, assetOutId, amountBN, slippage)
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
        amount: BN,
        isBounded: boolean
    ): Promise<{ bestDex: DexInterface; maxAmount: BN }> {
        const dexArray = isBounded ? this.boundedDexArray : this.unboundedDexArray;

        const dexResults = await Promise.all(
            dexArray.map(async (dex) => {
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

    async getTokenAmount(asset: string, amount: BN): Promise<number> {
        const tokenInfo = await this.getTokenInfo(asset);
        const value = parseFloat(amount.toString()) / Math.pow(10, tokenInfo.decimals);

        return value < MIN_OPERATION_VALUE ? 0 : value;
    }

    async getTokenAmountBN(asset: string, amount: number): Promise<BN> {
        const tokenInfo = await retry(async () => this.getTokenInfo(asset));
        const decimals = tokenInfo.decimals;

        return new BN(amount * Math.pow(10, decimals));
    }
}