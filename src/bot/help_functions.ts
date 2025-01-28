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


export function formatTokenNumber(num: number): string {
    let isConverted: boolean = false
    if (num < 0) {
        num = num * -1
        isConverted = true
    }

    let result : string = ''
    if (num > 1000) {
        result = Math.floor(num).toString();
    } else if (num > 100) {
        const parts = num.toString().split(".");
        result = parts[0] + (parts[1] ? "." + parts[1].slice(0, 1) : "");
    } else if (num > 10) {
        const parts = num.toString().split(".");
        result = parts[0] + (parts[1] ? "." + parts[1].slice(0, 3) : "");
    } else if (num > 1) {
        const parts = num.toString().split(".");
        result = parts[0] + (parts[1] ? "." + parts[1].slice(0, 4) : "");
    } else {
        const parts = num.toString().split(".");
        const fractional = parts[1] || ""; // Десятичная часть
        let significantIndex = fractional.search(/[1-9]/);

        if (significantIndex === -1) {
            return "0";
        }

        const truncated = fractional.slice(0, significantIndex + 3);
        result = `0.${truncated}`;
    }

    if (isConverted) {
        return "-" + result;
    } else {
        return result;
    }
}

export function formatPercentage(value: number): string {
    if (Math.abs(value) >= 10) {
        return `${Math.round(value)}`;
    } else if (Math.abs(value) >= 1) {
        return `${value.toFixed(1)}`;
    } else {
        return `${value.toFixed(3)}`;
    }
}