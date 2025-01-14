import {buildPoolId, getAssetId, MiraAmm, PoolId, ReadonlyMiraAmm} from "mira-dex-ts";
import {
    AssetId,
    Account,
    GetBalancesResponse,
    Provider,
    WalletUnlocked,
    ZeroBytes32,
    TxParams,
    Address,
    BN
} from "fuels";

// @ts-ignore
import dotenv from 'dotenv';
import {EstimateTransactionParams} from "@fuel-ts/account/dist/providers/provider";
import {CONTRACTS} from "./fuel/contracts";
import {retry} from "./utils/call_helper";
import {showBalances} from "./services/balance";
import * as https from "node:https";
import axios from "axios";
import axiosRetry from "axios-retry";
// Загружаем переменные окружения из .env файла
dotenv.config();

// Получаем данные из переменных окружения
const rpcUrl = process.env.RPC_URL;
const contractId = process.env.CONTRACT_ID;
const walletPK = process.env.WALLET_PK;

async function helloWorld(): Promise<void> {
    console.log("Hello, world!");
    const provider = await Provider.create(rpcUrl);
    const wallet = new WalletUnlocked(walletPK, provider);
    const miraAmm = new MiraAmm(wallet, contractId);
    const readonlyMiraAmm = new ReadonlyMiraAmm(provider, contractId);

    // Выбираем входной и выходной актив
    const assetIn = CONTRACTS.ASSET_FUEL;
    const assetOut = CONTRACTS.ASSET_ETH;

    // Получаем баланс указанного актива
    const balance: BN = await wallet.getBalance(assetIn.bits);
    console.log(`Balance for asset ${assetIn.bits}:`, balance.toString());

    // Создаём poolId
    const poolId = buildPoolId(assetIn, assetOut, false);

    /*try {
        // Генерируем параметры для свапа с использованием вашей функции
        const { amountOutMin, deadline, pools } = await generateSwapParams(
            readonlyMiraAmm,
            provider,
            poolId,
            balance,
            assetIn,
            assetOut
        );

        console.log(`Calculated amountOutMin: ${amountOutMin.toString()}, deadline: ${deadline}`);

        // Устанавливаем параметры транзакции
        const txParams = {
            gasLimit: 999999,
            maxFee: 999999,
        };


        const txRequest = await retry(async () => {
            return await miraAmm.swapExactInput(balance, assetIn, amountOutMin, pools, deadline, txParams);
        });

        const txCost = await wallet.getTransactionCost(txRequest);
        txRequest.gasLimit = txCost.gasUsed;
        txRequest.maxFee = txCost.maxFee;
        await retry(async () => wallet.fund(txRequest, txCost));

        const tx = await retry(async () => wallet.sendTransaction(txRequest));
        const txResponse = await retry(async () => tx.waitForResult());

        console.log("Swap successful! Transaction:", txResponse);
    } catch (error) {
        console.error("Swap failed:", error);
    }*/


    await showBalances(wallet, "After swap");
}

// To run the function
helloWorld().then(() => {
    console.log("Done.");
}).catch(error => {
    console.error("Error:", error);
});