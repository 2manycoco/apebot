import {BN, Provider} from "fuels";
import {AssetVerified} from "./model";
import axios from "axios";
import {retry} from "../utils/call_helper";

const VERIFIED_ASSETS_URL = "https://verified-assets.fuel.network/assets.json";

export async function futureDeadline(provider: Provider) {
    const block = await provider.getBlock("latest");
    return block?.height.add(1000) ?? new BN(null);
}

export async function getVerifiedAssets(): Promise<AssetVerified[]> {
    try {
        const response =  await retry(async () =>  axios.get(VERIFIED_ASSETS_URL));
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