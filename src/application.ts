import "reflect-metadata";
import {retry, setupGlobalHttpClient} from "./utils/call_helper";
import {startTelegramBot} from "./bot/app_telegram_bot";
import {AppDataSource} from "./database/database";
import {SessionManager} from "./bot/session_manager";
import dotenv from "dotenv";
import { Logger } from "./utils/logger";
import AnalyticsService from "./analytics/analytics_service";
import {sleep} from "fuels";
import {startVerifiedAssetsWorker} from "./fuel/asset/verified_assets_provider";

dotenv.config();

async function application() {
    try {
        // Set up global HTTP client
        setupGlobalHttpClient();

        // Initialize analytics
        await retry(async () => {
            AnalyticsService.getInstance()
            console.log("Analytics connected successfully.");
        });

        if (process.env.USE_LOCAL_STORAGE === "false") {
            // Initialize database
            await retry(async () => {
                const dbInstance = await AppDataSource.initialize();
                if (!dbInstance) {
                    throw new Error("Failed to initialize database instance.");
                }
                console.log("Database connected successfully.");
            });
        }

        // Initialize RPC (Session Manager)
        await retry(async () => {
            const sessionManagerInstance = await SessionManager.getInstance();
            if (!sessionManagerInstance) {
                throw new Error("Failed to initialize RPC instance (SessionManager).");
            }
            console.log("RPC connected successfully.");
        }, 20);

        // Cache Verified Assets
        await startVerifiedAssetsWorker()
        console.log("Verified assets fetch successfully.");

        // Start Telegram bot
        console.log("Starting the Telegram bot");
        await retry(async () => {
            await AnalyticsService.getInstance().trackEvent("bot_start")
            await startTelegramBot();
        });
    } catch (error) {
        await Logger.getInstance().e("bot_start_error", error.message)
        await sleep(5000)
        process.exit(1);
    }
}

application().then(() => {

}).catch((error) => {
    console.error("System failed to start:", error.message);
});