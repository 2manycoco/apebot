import {DexInterface} from "./dex.interface";
import {MiraDex} from "./mira-dex/mira_dex";

import dotenv from 'dotenv';
import {AssetId, BN, Provider, TransactionResult, WalletUnlocked} from "fuels";
import {retry} from "../utils/call_helper";
import {TokenInfo} from "./model";
import {getVerifiedAssets} from "../fuel/functions";

dotenv.config();

const rpcUrl = process.env.RPC_URL;
const contractId = process.env.CONTRACT_ID;

export class DexClient {
    private provider: Provider
    private wallet: WalletUnlocked
    private dexArray: DexInterface[] = [];

    constructor(provider: Provider, wallet: WalletUnlocked, contractId: string) {
        this.provider = provider;
        this.wallet = wallet;
        this.dexArray.push(new MiraDex(wallet, provider, contractId));
    }

    async calculateSwapAmount(assetIn: string, assetOut: string, amount: number): Promise<number> {
        const assetInId = { bits: assetIn };
        const assetOutId = { bits: assetOut };

        const tokenInfoOut = await this.getTokenInfo(assetOut);
        const decimalsOut = tokenInfoOut.decimals;

        const amountBN = await this.getTokenAmountBN(assetIn, amount);
        const result = await this.getBestRate(assetInId, assetOutId, amountBN);

        const maxAmount = result.maxAmount.toNumber();

        return maxAmount / Math.pow(10, decimalsOut);
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

    async getTokenInfo(asset: string) : Promise<TokenInfo> {
        for (const dex of this.dexArray) {
            try {
                const assetId = { bits: asset };
                return await dex.getTokenInfo(assetId);

            } catch (error) {
                console.info(`Failed to get token information from DEX: ${error.message}`);
            }
        }

        const verifiedAssets = await getVerifiedAssets();
        const matchedAsset = verifiedAssets.find((verified) => verified.assetId === asset);

        if (matchedAsset) {
            return {
                name: matchedAsset.name,
                symbol: matchedAsset.symbol,
                decimals: matchedAsset.decimals,
            };
        }

        throw new Error(`Token information not found for asset ID: ${asset}`);
    }

    async swap(assetIn: string, assetOut: string, amount: number): Promise<TransactionResult> {
        const assetInId = { bits: assetIn };
        const assetOutId = { bits: assetOut };

        const amountBN = await this.getTokenAmountBN(assetIn, amount);

        const { bestDex } = await this.getBestRate(assetInId, assetOutId, amountBN);

        try {
            return await bestDex.swap(assetInId, assetOutId, amountBN)
        } catch (error) {
            throw new Error(`Swap failed: ${error.message}`);
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
                return { dex, swapAmount: swapAmount };
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

    private async getTokenAmountBN(asset: string, amount: number): Promise<BN> {
        const tokenInfo = await retry(async () => this.getTokenInfo(asset));
        const decimals = tokenInfo.decimals;

        return new BN(amount * Math.pow(10, decimals));
    }
}

export async function buildDexClientFor(walletPK: string) : Promise<DexClient> {
    const provider = await Provider.create(rpcUrl);
    const wallet = new WalletUnlocked(walletPK, provider);

    return new DexClient(provider, wallet, contractId)
}