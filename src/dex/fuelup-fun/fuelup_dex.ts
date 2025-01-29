import {DexInterface} from "../dex.interface";
import {AssetId, BN, Provider, TransactionResult, WalletUnlocked} from "fuels";
import {TokenInfo} from "../model";
import {Strings} from "../../bot/resources/strings";
import {retry} from "../../utils/call_helper";
import axios from "axios";

const FUELUP_API_URL = "https://server.fuelup.fun/api/v1/asset/";

export class FuelUpDex implements DexInterface {
    private readonly wallet: WalletUnlocked;
    private readonly provider: Provider;

    constructor(provider: Provider, wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.provider = provider;
    }

    getRate(assetIn: AssetId, assetOut: AssetId): Promise<number> {
        throw Error(Strings.SWAP_TOKEN_NOT_BOUNDED_ERROR)
    }

    getSwapAmount(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<BN> {
        return Promise.resolve(new BN(0))
    }

    async getTokenInfo(asset: AssetId): Promise<TokenInfo> {
        const assetIdHex = asset.bits;
        const url = `${FUELUP_API_URL}${assetIdHex}?network=main_net`;

        try {
            const response = await retry(async () => axios.get(url), 5);
            const data = response.data;

            if (!data || !data.success || !data.data) {
                throw new Error(`[FuelUpDex] Invalid response for asset: ${assetIdHex}`);
            }

            return {
                assetId: data.data.asset_id,
                name: data.data.asset_name,
                symbol: data.data.asset_symbol,
                decimals: 9,
                isBounded: false,
            };
        } catch (error) {
            console.error(`[FuelUpDex] Failed to fetch token info for ${assetIdHex}:`, error.message);
            throw new Error(`[FuelUp] Could not retrieve token info`);
        }
    }

    swap(assetIn: AssetId, assetOut: AssetId, amount: BN, slippage: number): Promise<TransactionResult> {
        throw Error(Strings.SWAP_TOKEN_NOT_BOUNDED_ERROR)
    }
}