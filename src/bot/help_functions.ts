import {Context} from "telegraf";
import {ProgressAnimation} from "./widget/progress_animation";
import {Address} from "fuels";

export async function handleUserError(ctx: Context, error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Error handling command:", errorMessage);
    try {
        await ctx.reply(`Error: ${errorMessage}. Please try again later.`);
    } catch (e) {
    }
}

export async function replyProgress(ctx: Context): Promise<ProgressAnimation> {
    const animation = new ProgressAnimation(ctx)
    await animation.startAnimation()
    return animation
}

export async function withProgress<T>(
    ctx: Context,
    process: () => Promise<T>
): Promise<T> {
    const progress = await replyProgress(ctx)
    try {
        return await process()
    } catch (e) {
        throw e
    } finally {
        await progress.stopAnimation()
    }
}

export const escapeMarkdownV2 = (text: string): string => {
    return text.replace(/([*_`\[\]()~>#+\-=|{}.!\\])/g, '\\$1');
};
