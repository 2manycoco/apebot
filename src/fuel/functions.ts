import {BN, Provider, ScriptTransactionRequest, WalletUnlocked} from "fuels";
import dotenv from "dotenv";
import {ProviderOptions} from "@fuel-ts/account/dist/providers/provider";
import {NETWORK_CALL_TIMEOUT, retry} from "../utils/call_helper";
import type {AbstractAddress, AddressLike, BytesLike} from "@fuel-ts/interfaces";


dotenv.config();

const RPC_URL = process.env.RPC_URL!;

export async function createProvider(): Promise<Provider> {
    const providerOptions: ProviderOptions = {
        timeout: NETWORK_CALL_TIMEOUT,
        resourceCacheTTL: 60000,
        retryOptions: {
            maxRetries: 5,
            baseDelay: 500
        }
    };

    try {
        const provider = await Provider.create(RPC_URL, providerOptions);
        const version = await provider.getVersion()
        console.log(`Provider initialized successfully: ${version}`);
        return provider;
    } catch (error) {
        console.error("Failed to initialize provider:", error.message);
        throw error;
    }
}

export async function futureDeadline(provider: Provider) {
    const block = await provider.getBlock("latest");
    return block?.height.add(1000) ?? new BN(null);
}

export const isValidFuelAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{64}$/.test(address);
};

export async function transferWithFeeAdjustment(
    wallet: WalletUnlocked,
    destination: AbstractAddress,
    assetId: BytesLike,
    amountToSend: BN
): Promise<void> {
    const txRequest = new ScriptTransactionRequest();

    const resources = await wallet.getResourcesToSpend([
        { amount: amountToSend, assetId },
    ]);
    txRequest.addResources(resources);

    txRequest.addCoinOutput(destination, amountToSend, assetId);

    const chainInfo = wallet.provider.getChain();
    const minGas = txRequest.calculateMinGas(chainInfo);
    const maxGas = txRequest.calculateMaxGas(chainInfo, minGas);

    txRequest.maxFee = maxGas.mul(1.1);

    const txCost = await wallet.getTransactionCost(txRequest);

    const transactionFee = txCost.maxGas
    txRequest.gasLimit = transactionFee;

    if (amountToSend.lte(transactionFee)) {
        throw new Error(
            "Insufficient balance to cover transaction fee. Please add more funds."
        );
    }

    const adjustedAmount = amountToSend.sub(transactionFee);
    if (adjustedAmount.lte(new BN(0))) {
        throw new Error(
            "Insufficient amount after deducting transaction fee. Unable to proceed."
        );
    }

    const response = await wallet.transfer(
        destination,
        adjustedAmount,
        assetId
    );

     await retry(async () => {
        return await response.wait();
    }, 10);

    return Promise.resolve()
}