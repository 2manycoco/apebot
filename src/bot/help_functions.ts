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


export function formatTokenNumber(num: number): string {
    if (num <= 0) {
        throw new Error("The number should be positive.");
    }

    if (num > 1000) {
        return Math.floor(num).toString(); // Без десятичных
    } else if (num > 100) {
        // Оставляем одну десятичную часть
        const parts = num.toString().split(".");
        return parts[0] + (parts[1] ? "." + parts[1].slice(0, 1) : "");
    } else if (num > 10) {
        // Оставляем три десятичные части
        const parts = num.toString().split(".");
        return parts[0] + (parts[1] ? "." + parts[1].slice(0, 3) : "");
    } else if (num > 1) {
        // Оставляем четыре десятичные части
        const parts = num.toString().split(".");
        return parts[0] + (parts[1] ? "." + parts[1].slice(0, 4) : "");
    } else {
        // Если меньше 1, ищем первое ненулевое число после точки
        const parts = num.toString().split(".");
        const fractional = parts[1] || ""; // Десятичная часть
        let significantIndex = fractional.search(/[1-9]/);

        if (significantIndex === -1) {
            return "0"; // Если число состоит только из нулей
        }

        // Показываем первое ненулевое число и еще 2 цифры
        const truncated = fractional.slice(0, significantIndex + 3);
        return `0.${truncated}`;
    }
}