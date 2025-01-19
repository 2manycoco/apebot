import {Context} from "telegraf";
import {ProgressAnimation} from "./widget/progress_animation";

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

export async function withProgress(
    ctx: Context,
    process: () => Promise<void>
): Promise<void> {
    const progress = await replyProgress(ctx)
    await process()
    await progress.stopAnimation()
}
