import http from 'node:http';
import https from "node:https";
import axios from "axios";
import axiosRetry from "axios-retry";

export const NETWORK_CALL_TIMEOUT = 10000 // 10 sec

export function setupGlobalHttpClient() {
    const timeout = NETWORK_CALL_TIMEOUT
    const agent = new https.Agent({
        keepAlive: true,
        timeout: timeout,
    });

    const httpAgent = new http.Agent({
        keepAlive: true
    });
    const httpsAgent = new https.Agent({
        keepAlive: true
    });


    axios.defaults.timeout = timeout;
    http.globalAgent = httpAgent
    https.globalAgent = httpsAgent
    axios.defaults.httpAgent = agent;
    axios.defaults.httpsAgent = agent;
    axiosRetry(axios, {retries: 5, retryDelay: axiosRetry.exponentialDelay});
}

export async function retry<T>(
    fn: () => Promise<T>,
    retries = 10,
    delay = 300,
    onlyNetwork: boolean = true,
): Promise<T> {
    let attempt = 0;

    while (attempt < retries) {
        try {
            return await fn();
        } catch (error: any) {
            if (onlyNetwork && error.cause?.code !== "ECONNRESET") {
                throw error;
            }

            attempt++;
            if (attempt >= retries) {
                throw error;
            }

            console.log(`Retrying due to network error... Attempt ${attempt}/${retries}`);
            await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
    }

    throw new Error("Retry failed after max attempts");
}

export async function retryAll<T>(
    fn: () => Promise<T>,
    retries = 10,
    delay = 300
): Promise<T> {
    return retry(fn, retries, delay, false);
}
