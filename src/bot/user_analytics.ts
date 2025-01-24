import {Context} from "telegraf";
import {EventOptions} from "@amplitude/analytics-types/lib/esm/base-event";
import AnalyticsService from "../analytics/analytics_service";

export function trackUserAnalytics(ctx: Context, eventName: string, properties?: Record<string, any>) {
    const user = ctx.from;

    if (!user) {
        return
    }

    const params: Record<string, any> = {
        is_bot: user.is_bot || false,
        is_premium: user.is_premium || false,
        is_attached: user.added_to_attachment_menu || false,
    }

    if (properties && Object.keys(properties).length > 0) {
        Object.assign(params, properties);
    }

    const eventOptions: EventOptions = {
        user_id: user.id.toString(),
        time: Date.now(),
        language: user.language_code || undefined,
        platform: "Telegram",
    };

    AnalyticsService.getInstance().trackUserAction(eventName, params, eventOptions)
}