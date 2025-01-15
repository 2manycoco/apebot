import {BN, Provider} from "fuels";
import {AssetVerified} from "./model";
import axios from "axios";
import {retry} from "../utils/call_helper";

const VERIFIED_ASSETS_URL = "https://verified-assets.fuel.network/assets.json";

export async function futureDeadline(provider: Provider) {
    const block = await provider.getBlock("latest");
    return block?.height.add(1000) ?? new BN(null);
}