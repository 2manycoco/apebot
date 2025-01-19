import * as amplitude from '@amplitude/analytics-node';
import dotenv from "dotenv";
import path from "node:path";
import {EventOptions} from "@amplitude/analytics-types";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const API_KEY = process.env.AMPLITUDE_API_KEY;
const DEVICE_ID = "server";
const SERVER_OPTIONS = {
    user_id: DEVICE_ID,
    device_id: DEVICE_ID
}

class AnalyticsService {
    private static instance: AnalyticsService;

    // Singleton instance
    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            amplitude.init(API_KEY);
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    /**
     * Log user event.
     * @param eventName Name of the event
     * @param properties Additional properties for the event
     * @param eventOptions Must contain userId
     */
    public async trackUserAction(eventName: string, properties?: Record<string, any>, eventOptions?: EventOptions): Promise<void> {
        this.trackEventInternal(eventName, properties, eventOptions);
    }

    /**
     * Log a generic event.
     * @param eventName Name of the event
     * @param properties Additional properties for the event
     */
    public async trackEvent(eventName: string, properties?: Record<string, any>): Promise<void> {
        this.trackEventInternal(eventName, properties, SERVER_OPTIONS)
    }

    /**
     * Log an error event.
     * @param errorName The error name
     * @param errorMessage The error message
     * @param properties Additional properties related to the error
     */
    public async trackError(errorName: string, errorMessage: string, properties?: Record<string, any>): Promise<void> {
        const eventProperties: Record<string, any> = {
            error_message: errorMessage || "",
        }

        if (properties && Object.keys(properties).length > 0) {
            Object.assign(eventProperties, properties);
        }

        this.trackEventInternal(errorName, eventProperties, SERVER_OPTIONS);
    }

    private trackEventInternal(eventName: string, eventProperties?: Record<string, any>, eventOptions?: EventOptions) {
        try {
            amplitude.track(eventName, eventProperties, eventOptions);
        } catch (e) {
            console.info("Analytics error:", `${e}`)
        }
    }
}

export default AnalyticsService;
