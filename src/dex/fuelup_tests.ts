import dotenv from "dotenv";
import {CONTRACTS, TRADE_ASSET} from "../fuel/asset/contracts";
import * as path from "node:path";
import {retry, setupGlobalHttpClient} from "../utils/call_helper";
import {startVerifiedAssetsWorker} from "../fuel/asset/verified_assets_provider";
import {Address, BN, Provider, WalletUnlocked} from "fuels";
import {DexClient} from "./dex_client";
import {transferWithFeeAdjustment} from "../fuel/functions";
import {FuelUpDex} from "./fuelup-fun/fuelup_dex";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const RPC_URL = process.env.RPC_URL;
const WALLET_PK = process.env.TEST_WALLET_PK;
const TRANSFER_WALLET = process.env.TRANSFER_WALLET;

/**
 * Function to create an instance of DexClient and test its methods
 */
async function testFuelUp() {
    try {
        setupGlobalHttpClient()

        const assetIn = CONTRACTS.ASSET_FUEL;
        const assetOut = CONTRACTS.ASSET_FUELUP;
        const transferAsset = TRADE_ASSET
        const swapAmount = 1;
        const swapAmountBN = new BN(10);

        await startVerifiedAssetsWorker()

        console.log("Building FuelUpDex...");
        let provider: Provider
        let wallet: WalletUnlocked
        const fuelUpDex = await retry(
            async () => {
                provider = await Provider.create(RPC_URL);
                wallet = new WalletUnlocked(WALLET_PK, provider);

                return new FuelUpDex(wallet)
            },
            10
        );

        console.log("Testing getTokenInfo...");
        const amount = await fuelUpDex.getSwapAmount(assetIn, assetOut, swapAmount, swapAmountBN);
        if (amount == null) {
            console.log("Testing getTokenInfo Failed");
            return
        }
        console.log(`Result amount ${amount}:`);

        console.log("All methods executed successfully.");
    } catch (error) {
        console.error("Error testing FuelUpDex:", error.message);
    }
}

// Run the test function
testFuelUp().then(() => {
    console.log("Test completed.");
});