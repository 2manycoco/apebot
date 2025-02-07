import {DexInterface} from "../dex.interface";
import {AssetId, BN, Provider, TransactionResult, WalletUnlocked, Contract, bn} from "fuels";
import {TokenInfo} from "../model";
import {Strings} from "../../bot/resources/strings";
import {retry} from "../../utils/call_helper";
import axios from "axios";
import {Amm} from "./typegen/Amm";
import dotenv from "dotenv";
import path from "node:path";
import {CONTRACTS, TRADE_ASSET} from "../../fuel/asset/contracts";
import {futureDeadline} from "../../fuel/functions";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const FUEL_ASSETS_DECIMAL = 9
const SENT_TO_MIRA_STATUS = "sent"
const ACTIVE_STATUS = "active"

export class FuelUpDex implements DexInterface {
    private readonly wallet: WalletUnlocked;
    private readonly amm: Contract;

    constructor(wallet: WalletUnlocked) {
        this.wallet = wallet;
        this.amm = new Amm(process.env.FUELUP_FUEL_AMM, this.wallet);
    }

    async getTokenInfo(asset: AssetId): Promise<TokenInfo> {
        const assetIdHex = asset.bits;
        const url = `${process.env.FUELUP_API_URL}asset/${assetIdHex}?network=main_net`;

        try {
            const response = await retry(async () => axios.get(url), 5);
            const data = response.data;

            if (!data || !data.success || !data.data) {
                throw new Error(`Invalid response for asset: ${assetIdHex}`);
            }

            const status = data.data.status;
            const isStatusValid = status == SENT_TO_MIRA_STATUS || status == ACTIVE_STATUS;

            if (!isStatusValid) {
                throw new Error(`Invalid asset status - ${status}`);
            }

            return {
                assetId: data.data.asset_id,
                name: data.data.asset_name,
                symbol: data.data.asset_symbol,
                decimals: 9,
                isBounded: status == SENT_TO_MIRA_STATUS
            };
        } catch (error) {
            console.error(`FuelUpDex: Failed to fetch token info for ${assetIdHex}:`, error.message);
            throw new Error(`Could not retrieve token info`);
        }
    }

    async getRate(assetIn: AssetId, assetOut: AssetId): Promise<number> {
        const amountBN = bn.parseUnits(
            "1",
            FUEL_ASSETS_DECIMAL
        );

        let amountOut: BN
        if (assetIn.bits == TRADE_ASSET.bits) {
            amountOut = await this.previewBuy(assetOut, amountBN)
        } else {
            amountOut = await this.previewSell(assetIn, amountBN)
        }

        return parseFloat(amountOut.formatUnits(FUEL_ASSETS_DECIMAL));
    }

    async getSwapAmount(assetIn: AssetId, assetOut: AssetId, amount: BN): Promise<BN> {
        if (assetIn.bits == TRADE_ASSET.bits) {
            return await this.previewBuy(assetOut, amount)
        } else {
            return await this.previewSell(assetIn, amount)
        }
    }

    private async previewSell(assetId: AssetId, amount: BN): Promise<BN> {
        const preview = await retry(async () => {
            return await this.amm.functions
                .preview_sell_exact_input(assetId, amount)
                .get();
        }, 5)

        return preview.value.amount_out;
    }

    private async previewBuy(assetId: AssetId, amountBN: BN): Promise<BN> {
        const preview = await retry(async () => {
            return await this.amm.functions
                .preview_buy_exact_input(assetId, amountBN)
                .get();
        }, 5)

        return preview.value.amount_out;
    }

    async swap(assetIn: AssetId, assetOut: AssetId, amount: BN, slippage: number): Promise<TransactionResult> {
        if (assetIn.bits == TRADE_ASSET.bits) {
            return await this.buy(assetOut, amount)
        } else {
            return await this.sell(assetIn, amount)
        }
    }

    private async sell(assetId: AssetId, amount: BN): Promise<TransactionResult> {
        const deadline = await futureDeadline(this.wallet.provider);

        const transaction = await retry(async () => {
            return await this.amm.functions
                .sell_exact_input(assetId, undefined, deadline) // undefined for slippage
                .callParams({
                    forward: [amount, assetId.bits],
                })
                .call();
        }, 5)

        const result = await transaction.waitForResult();
        return result.transactionResult;
    }

    private async buy(assetId: AssetId, amount: BN): Promise<TransactionResult> {
        const deadline = await futureDeadline(this.wallet.provider);

        const transaction = await retry(async () => {
            return await this.amm.functions
                .buy_exact_input(assetId, undefined, deadline) // undefined for slippage
                .callParams({
                    forward: [amount, CONTRACTS.ASSET_FUEL.bits],
                })
                .call();
        }, 5)


        const result = await transaction.waitForResult();
        return result.transactionResult;
    }
}