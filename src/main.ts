import "reflect-metadata";
import {retry, setupGlobalHttpClient} from "./utils/call_helper";
import {startTelegramBot} from "./bot/app_telegram_bot";
import {AppDataSource} from "./database/database";
import {SessionManager} from "./bot/session_manager";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    try {
        // Set up global HTTP client
        setupGlobalHttpClient();

        if (!process.env.USE_LOCAL_STORAGE) {
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
        });

        // Start Telegram bot
        await retry(async () => {
            await startTelegramBot();
            console.log("Telegram bot started successfully.");
        });
    } catch (error) {
        console.error("Error during initialization:", error.message);
        process.exit(1); // Exit process on critical failure
    }
}

main().then(() => {
    console.log("System started.");
}).catch((error) => {
    console.error("System failed to start:", error.message);
});