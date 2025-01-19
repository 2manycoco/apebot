import axios from "axios";
import {retry} from "../../utils/call_helper";

const VERIFIED_ASSETS_URL = "https://verified-assets.fuel.network/assets.json";

export interface AssetVerified {
    name: string;
    symbol: string;
    decimals: number;
    assetId: string;
}

let cachedAssets: AssetVerified[] = [];
let isUpdating = false;

export async function fetchVerifiedAssets(): Promise<AssetVerified[]> {
    try {
        const response = await retry(async () => axios.get(VERIFIED_ASSETS_URL));
        const assets: any[] = response.data;

        // Маппинг в структуру AssetVerified
        return assets
            .flatMap((asset) => {
                return asset.networks
                    .filter((network: any) => network.type === "fuel" && network.assetId)
                    .map((network: any) => ({
                        name: asset.name,
                        symbol: asset.symbol,
                        decimals: network.decimals,
                        assetId: network.assetId,
                    }));
            });
    } catch (error) {
        console.error("Failed to fetch verified assets:", error.message);
        throw new Error("Could not fetch verified assets");
    }
}

/**
 * Обновление кеша верифицированных токенов.
 */
async function updateVerifiedAssetsCache(): Promise<void> {
    if (isUpdating) return;
    isUpdating = true;

    try {
        cachedAssets = await fetchVerifiedAssets();
        console.log("Verified assets cache updated successfully.");
    } catch (error) {
        console.error("Failed to update verified assets cache:", error.message);
    } finally {
        isUpdating = false;
    }
}

/**
 * Функция для получения верифицированных токенов с кеша.
 */
export async function getVerifiedAssets(): Promise<AssetVerified[]> {
    if (cachedAssets.length === 0) {
        console.log("Cache is empty. Fetching verified assets...");
        await updateVerifiedAssetsCache();
    }
    return cachedAssets;
}


export async function startVerifiedAssetsWorker() {
    await updateVerifiedAssetsCache();
    setInterval(() => {
        updateVerifiedAssetsCache();
    }, 30 * 60 * 1000); // 30 mins
}