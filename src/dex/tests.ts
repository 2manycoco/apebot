import dotenv from "dotenv";
import {CONTRACTS, TRADE_ASSET} from "../fuel/asset/contracts";
import * as path from "node:path";
import {retry, setupGlobalHttpClient} from "../utils/call_helper";
import {startVerifiedAssetsWorker} from "../fuel/asset/verified_assets_provider";
import {Address, Provider, WalletUnlocked} from "fuels";
import {DexClient} from "./dex_client";
import {transferWithFeeAdjustment} from "../fuel/functions";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const RPC_URL = process.env.RPC_URL;
const WALLET_PK = process.env.WALLET_PK;
const TRANSFER_WALLET = process.env.TRANSFER_WALLET;

/**
 * Function to create an instance of DexClient and test its methods
 */
async function testDexClient() {
    try {
        setupGlobalHttpClient()

        const assetIn = CONTRACTS.ASSET_ETH.bits;
        const assetOut = CONTRACTS.ASSET_FUEL.bits;
        const transferAsset = TRADE_ASSET
        const transferAddress = Address.fromAddressOrString(TRANSFER_WALLET)
        const swapAmount = 0.001;

        await startVerifiedAssetsWorker()

        console.log("Building DexClient...");
        let provider: Provider
        let wallet: WalletUnlocked
        const dexClient = await retry(
            async () => {
                provider = await Provider.create(RPC_URL);
                wallet = new WalletUnlocked(WALLET_PK, provider);

                return new DexClient(provider, wallet)
            },
            10
        );

        console.log(`Testing getBalance ${transferAsset.symbol} ...`);
        const [balance, balanceBN] = await dexClient.getBalance(transferAsset.bits);
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

        console.log(`Testing transfer ${transferAsset.symbol} to ${transferAddress}`);
        await transferWithFeeAdjustment(wallet, transferAddress, transferAsset.bits, balanceBN);
        console.log(`Transfer successful`);

        console.log(`Testing getBalance after transfer ${transferAsset.symbol} ...`);
        const [balanceAfter] = await dexClient.getBalance(transferAsset.bits);
        if (balanceAfter == null) {
            console.log("Testing etBalance after transfer Failed");
            return
        }
        console.log(`Balance: ${balance}`);

        /*
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
        */

        console.log("All methods executed successfully.");
    } catch (error) {
        console.error("Error testing DexClient:", error.message);
    }
}

// Run the test function
testDexClient().then(() => {
    console.log("Test completed.");
});