import {
    Address,
    BN,
    CoinQuantity,
    Provider,
    ScriptTransactionRequest,
    TransactionCost,
    TransactionRequest,
    WalletUnlocked
} from "fuels";
import dotenv from "dotenv";
import {ProviderOptions} from "@fuel-ts/account/dist/providers/provider";
import {NETWORK_CALL_TIMEOUT, retry} from "../utils/call_helper";
import type {AbstractAddress, AddressLike, BytesLike} from "@fuel-ts/interfaces";
import path from "node:path";


dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const FEE_PERCENTAGE = parseFloat(process.env.FEE_PERCENTAGE)
const FEE_RECIPIENT = Address.fromAddressOrString(process.env.FEE_RECIPIENT)

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

export async function createProvider(): Promise<Provider> {
    const providerOptions: ProviderOptions = {
        timeout: NETWORK_CALL_TIMEOUT,
        resourceCacheTTL: 60000,
        retryOptions: {
            maxRetries: 5,
            baseDelay: 300
        }
    };

    const provider = await Provider.create(RPC_URL, providerOptions);
    const version = await provider.getVersion()
    console.log(`Provider initialized successfully: ${version}`);
    return provider;
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
        {amount: amountToSend, assetId},
    ]);
    txRequest.addResources(resources);

    txRequest.addCoinOutput(destination, amountToSend, assetId);

    const txCost = await retry(() => {
            return setupMaxGas(txRequest, wallet)
        }, 5
    )

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

export async function setupMaxGas(txRequest: TransactionRequest, wallet: WalletUnlocked): Promise<TransactionCost> {
    const chainInfo = wallet.provider.getChain();
    const minGas = txRequest.calculateMinGas(chainInfo);
    const maxGas = txRequest.calculateMaxGas(chainInfo, minGas);

    txRequest.maxFee = maxGas.mul(1.15);

    return await wallet.getTransactionCost(txRequest);
}

/**
 * Apply slippage to the given amount in BN.
 * @param amount The amount to which slippage should be applied (e.g., 100 tokens in BN).
 * @param slippage The slippage percentage as a number (e.g., 0.5 for 0.5%).
 * @returns The minimum acceptable amount after applying slippage as BN.
 */
export function applySlippageBN(amount: BN, slippage: number): BN {
    if (slippage < 0 || slippage > 100) {
        throw new Error("Slippage must be a percentage between 0 and 100.");
    }

    // Use a scaling factor to preserve precision
    const scalingFactor = new BN(10000); // For precision (e.g., 0.01% => 1/10000)
    const slippageMultiplier = scalingFactor.sub(new BN(slippage * 100)); // 10000 - slippage * 100

    // Calculate the minimum acceptable amount
    return amount.mul(slippageMultiplier).div(scalingFactor); // amount * (1 - slippage) / 10000
}

/**
 * Calculate the fee amount based on the given percentage.
 * @param amountOut - The total amount of the transaction (BN).
 * @returns The calculated fee as a BN.
 */
export function calculateFeeAmount(amountOut: BN): BN {
    const feeMultiplier = new BN(Math.floor(FEE_PERCENTAGE * 10000));
    return amountOut.mul(feeMultiplier).div(new BN(10000));
}

/**
 * Add a fee output to a transaction request.
 * @param wallet - User wallet
 * @param txRequest - The transaction request object to modify.
 * @param feeAmount - The calculated fee amount (BN).
 * @param assetId - The asset ID for the fee (BytesLike).
 */
export async function addFeeToTransaction(
    wallet: WalletUnlocked,
    txRequest: TransactionRequest,
    feeAmount: BN,
    assetId: string
): Promise<void> {
    const quantities: CoinQuantity[] = [
        {
            amount: feeAmount,
            assetId: assetId,
        }
    ];
    const resources = await wallet.getResourcesToSpend(quantities);
    txRequest.addResources(resources);
    txRequest.addCoinOutput(FEE_RECIPIENT, feeAmount, assetId);
}