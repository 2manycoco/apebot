import {BN, Provider} from "fuels";
import dotenv from "dotenv";
import {ProviderOptions} from "@fuel-ts/account/dist/providers/provider";
import {NETWORK_CALL_TIMEOUT} from "../utils/call_helper";


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