import {BN, TransactionResult} from "fuels";
import {AssetId} from "@fuel-ts/interfaces";
import {TokenInfo} from "./model";

export interface DexInterface {
    getTokenInfo(asset: AssetId): Promise<TokenInfo>;

    getSwapAmount(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<BN>;

    swap(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<TransactionResult>;
}