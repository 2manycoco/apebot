import {Telegraf, Context} from "telegraf";
import {Actions, ActionValues, CommandKeys, Commands, CommandValues} from "./actions";
import {UserSession} from "./user_session";
import {SessionManager} from "./session_manager";
import {handleUserError} from "./help_functions";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

// Create an instance of Telegraf with your app_telegram_bot token
const app_telegram_bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Handle commands
app_telegram_bot.command(Object.values(Commands), async (ctx) => {
    await handleUserInteraction(ctx, async (session) => {
        // Remove leading "/" from the command
        const commandText = ctx.message.text.slice(1).toLowerCase();

        // Check if the command matches any defined CommandKeys
        if ((Object.values(Commands) as CommandValues[]).includes(commandText as CommandValues)) {
            const command = commandText as CommandValues;
            await session.handleCommand(command);
        } else {
            console.warn(`Unknown command received: ${commandText}`);
        }
    });
});

// Handle button clicks
app_telegram_bot.action(Object.values(Actions), async (ctx) => {
    await handleUserInteraction(ctx, async (session) => {
        const action = ctx.match?.[0] as ActionValues;
        if (!action) {
            await ctx.reply("Unable to process action. Please try again.");
            return;
        }

        // Set action for the session
        await session.handleAction(action);
    });
});

//Help functions
async function handleUserInteraction(
    ctx: Context,
    callback: (session: UserSession) => Promise<void>
): Promise<void> {
    try {
        const session = await getSession(ctx);
        await callback(session);
    } catch (error) {
        await handleUserError(ctx, error);
    }
}

async function getSession(ctx: Context) {
    const sessionManager = await SessionManager.getInstance()

    const userId = ctx.from?.id;

    if (!userId) {
        throw Error("Unable to identify user. Please try again later.");
    }

    return await sessionManager.getSession(ctx, userId);
}


export async function startTelegramBot() {
    return app_telegram_bot.launch();
}

// Gracefully stop the app_telegram_bot on termination
process.once("SIGINT", () => app_telegram_bot.stop("SIGINT"));
process.once("SIGTERM", () => app_telegram_bot.stop("SIGTERM"));
