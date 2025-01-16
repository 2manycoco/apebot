import {Context} from "telegraf";
import {Any} from "telegraf/typings/core/helpers/util";

export async function handleUserError(ctx: Context, error: unknown){
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error handling command:", errorMessage);
    try {
        await ctx.reply(`Error: ${errorMessage}. Please try again later.`);
    }catch (e) { }
}
