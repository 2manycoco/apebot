import http from 'node:http';
import https from "node:https";
import axios from "axios";
import axiosRetry from "axios-retry";

export const NETWORK_CALL_TIMEOUT = 15000 // 15 sec

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
    retries = 30,
    delay = 200
): Promise<T> {
    let attempt = 0;

    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            if (attempt >= retries) {
                throw error;
            }
            console.log(`Retrying... Attempt ${attempt}/${retries}`);
            await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
    }

    throw new Error("Retry failed after max attempts");
}