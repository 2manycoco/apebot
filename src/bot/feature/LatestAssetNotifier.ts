import axios from "axios";
import fs from "fs/promises";
import dotenv from "dotenv";
import path from "path";
import {app_telegram_bot} from "../app_telegram_bot";
import {getUserRepository, UserStorage} from "../../database/user_repository";
import {LatestAsset} from "./LatestAsset";
import {retry, retryAll} from "../../utils/call_helper";
import {Logger} from "../../utils/logger";


dotenv.config({path: path.resolve(__dirname, "../../../.env.secret")});

const LATEST_ASSET_FILE = path.resolve(process.env.FILE_DIR, "latestAsset.json");

interface LatestAssetData {
    assetId: string;
}

const ACTIVE_STATUS = "active"
const FUELUP_LINK = "https://fuelup.fun/pool/"

export class LatestAssetNotifier {
    private static instance: LatestAssetNotifier;
    private currentAssetId: string | null = null;
    private pollInterval: NodeJS.Timeout | null = null;

    private constructor() {
    }

    public static getInstance(): LatestAssetNotifier {
        if (!LatestAssetNotifier.instance) {
            LatestAssetNotifier.instance = new LatestAssetNotifier();
        }
        return LatestAssetNotifier.instance;
    }

    public async init(): Promise<void> {
        try {
            const data = await fs.readFile(LATEST_ASSET_FILE, "utf8");
            const parsed: LatestAssetData = JSON.parse(data);
            this.currentAssetId = parsed.assetId;
        } catch (error) {
            this.currentAssetId = null;
        }
    }

    public start(): void {
        this.pollInterval = setInterval(async () => {
            try {
                const url = `${process.env.FUELUP_API_URL}trade/latestCreatedAsset?network=main_net`;
                const response = await retry(async () => axios.get(url), 3);

                if (response.data.success) {
                    if (response.data && response.data.data && response.data.data.latest_asset) {
                        const latestAssetResponse = response.data.data.latest_asset;
                        const newAssetId = latestAssetResponse.asset_id;
                        if (this.currentAssetId !== newAssetId && latestAssetResponse.status == ACTIVE_STATUS) {
                            const latestAsset: LatestAsset = LatestAsset.fromJSON(latestAssetResponse);
                            this.currentAssetId = latestAsset.assetId;
                            await this.saveLatestAsset(latestAsset);
                            await this.notifyUsers(latestAsset);
                        }
                    } else {
                        Logger.getInstance().e("LatestAssetNotifier start()", "Invalid response structure from latest asset API.");
                    }
                }
            } catch (error: any) {
                Logger.getInstance().e("LatestAssetNotifier start()", error.message);
            }
        }, 10000);
    }

    private async saveLatestAsset(asset: LatestAsset): Promise<void> {
        const data: LatestAssetData = {
            assetId: asset.assetId
        };
        try {
            await fs.writeFile(LATEST_ASSET_FILE, JSON.stringify(data), "utf8");
        } catch (error: any) {
            Logger.getInstance().e("LatestAssetNotifier saveLatestAsset()", error.message);
        }
    }

    private async notifyUsers(asset: LatestAsset): Promise<void> {
        try {
            const userRepo = getUserRepository()
            const users = await userRepo.getAllUsers()
            const notifyUsers = users.filter(user => user.isNotificationsEnabled);

            const header = `*New token - ${asset.assetName} (${asset.assetSymbol}) 🚀*`;
            const description = asset.description;
            const assetIdLine = `Contract: \`${asset.assetId}\``;
            const image = asset.assetImg

            const links: string[] = [];
            if (asset.twitterLink) {
                links.push(`[Twitter](${asset.twitterLink})`);
            }
            if (asset.telegramLink) {
                links.push(`[Telegram](${asset.telegramLink})`);
            }
            if (asset.websiteLink) {
                links.push(`[Website](${asset.websiteLink})`);
            }
            links.push(`[FuelUp](${FUELUP_LINK}${asset.assetId})`);

            const linksLine = links.join(" || ");
            const message = `${header}\n${description}\n\n${assetIdLine}\n\n${linksLine}`;

            for (const user of notifyUsers) {
                try {
                    await retryAll(async () =>
                        app_telegram_bot.telegram.sendPhoto(
                            user.telegramId.toString(),
                            image,
                            {
                                caption: message,
                                parse_mode: "Markdown"
                            }
                        ), 5);
                } catch (error: any) {
                    console.error(`Failed to notify user ${user.telegramId}:`, error.message);
                }
            }
        } catch (error: any) {
            Logger.getInstance().e("LatestAssetNotifier notifyUsers()", error.message);
        }
    }

    public stop(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }
}
