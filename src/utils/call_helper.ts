import http from 'node:http';
import https from "node:https";
import axios from "axios";
import axiosRetry from "axios-retry";

export function setupGlobalHttpClient() {
    const timeout = 20000
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


    axios.defaults.timeout = 20000;
    http.globalAgent = httpAgent
    https.globalAgent = httpsAgent
    axios.defaults.httpAgent = agent;
    axios.defaults.httpsAgent = agent;
    axiosRetry(axios, {retries: 7, retryDelay: axiosRetry.exponentialDelay});
}

export async function retry<T>(
    fn: () => Promise<T>,
    retries = 5,
    delay = 1500
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