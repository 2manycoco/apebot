import {buildDexClientFor} from "./dex_client";
import dotenv from "dotenv";
import {CONTRACTS} from "../fuel/asset/contracts";
import * as path from "node:path";
import {retry, setupGlobalHttpClient} from "../utils/call_helper";
import {startVerifiedAssetsWorker} from "../fuel/asset/verified_assets_provider";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const walletPK = process.env.WALLET_PK;

/**
 * Function to create an instance of DexClient and test its methods
 */
async function testDexClient() {
    try {
        setupGlobalHttpClient()

        const assetIn = CONTRACTS.ASSET_ETH.bits;
        const assetOut = CONTRACTS.ASSET_FUEL.bits;
        const swapAmount = 0.000557768;

        startVerifiedAssetsWorker()

        console.log("Building DexClient...");
        const dexClient = await retry(
            async () => buildDexClientFor(walletPK),
            10
        );

        console.log("Testing getBalance...");
        const balance = await dexClient.getBalance(assetIn);
        if (balance == null) {
            console.log("Testing getBalances Failed");
            return
        }
        console.log(`Balance: ${balance}`);

        console.log("Testing getBalances...");
        const balances = await dexClient.getBalances();
        if (balances == null) {
            console.log("Testing getBalances Failed");
            return
        }
        console.log("Balances:");
        balances.forEach(([symbol, balance]) => {
            console.log(`${symbol}:  ${balance}`);
        });

        console.log("Testing getTokenInfo...");
        const tokenInfoAssetIn = await dexClient.getTokenInfo(assetIn);
        if (tokenInfoAssetIn == null) {
            console.log("Testing getTokenInfo Failed");
            return
        }
        console.log(`Token Info for ${assetIn}:`, tokenInfoAssetIn);
        const tokenInfoOut = await dexClient.getTokenInfo(assetOut);
        if (tokenInfoOut == null) {
            console.log("Testing getTokenInfo Failed");
            return
        }
        console.log(`Token Info for ${assetOut}:`, tokenInfoOut);
        const tokenInfoFairy = await dexClient.getTokenInfo(CONTRACTS.ASSET_FAIRY.bits);
        if (tokenInfoFairy == null) {
            console.log("Testing getTokenInfo Failed");
            return
        }
        console.log(`Token Info for ${CONTRACTS.ASSET_FAIRY.bits}:`, tokenInfoFairy);

        console.log("Testing calculateSwapAmount...");
        const calculatedAmount = await dexClient.calculateSwapAmount(assetIn, assetOut, swapAmount);
        if (calculatedAmount == null) {
            console.log("Testing calculateSwapAmount Failed");
            return
        }
        console.log(
            `Calculated Swap Amount for ${swapAmount} ${tokenInfoAssetIn.symbol} -> ${tokenInfoOut.symbol} :`,
            calculatedAmount
        );

        console.log("Testing swap...");
        const swapResult = await dexClient.swap(assetIn, assetOut, swapAmount);
        if (swapResult == null) {
            console.log("Testing swap Failed");
            return
        }
        console.log("Swap successfully");

        console.log("All methods executed successfully.");
    } catch (error) {
        console.error("Error testing DexClient:", error.message);
    }
}

// Run the test function
testDexClient().then(() => {
    console.log("Test completed.");
});