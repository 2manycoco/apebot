import {Context} from "telegraf";
import {Logger} from "../../utils/logger";
import AnalyticsService from "../../analytics/analytics_service";
import {ActionValues} from "../actions";
import {Message} from "@telegraf/types";
import {UserManager} from "../user_manager";

export abstract class Flow {
    protected userId: number;
    protected ctx: Context;
    protected logger: Logger
    protected analytics: AnalyticsService
    protected userManager: UserManager
    private sentMessageIds: number[] = [];

    protected constructor(ctx: Context, userId: number) {
        this.userId = userId;
        this.ctx = ctx
        this.logger = Logger.getInstance()
        this.analytics = AnalyticsService.getInstance()
        this.userManager = new UserManager(ctx, userId)
    }
    /**
     * Called when the Flow is started.
     */
    public abstract start(): Promise<void>;

    /**
     * Handles callback actions for buttons during the Flow.
     * @param action The action string received from the button callback.
     */
    public abstract handleAction(action: ActionValues): Promise<boolean>;

    /**
     * Handles user input during the Flow.
     * @param message The message or input from the user.
     */
    public abstract handleMessage(message: string): Promise<boolean>;

    protected async handleMessageResult(){

    }

    protected async handleMessageResponse(
        sendAction: () => Promise<Message>
    ): Promise<void> {
        const message = await sendAction();
        if (message?.message_id) {
            this.sentMessageIds.push(message.message_id);
        }
    }

    public abstract isFinished(): boolean

    /**
     * Cleans up the Flow if the user cancels it or completes it.
     */
    public async cleanup(): Promise<void> {
        return await this.clearMessages()
    }

    private async clearMessages(): Promise<void> {
        for (const messageId of this.sentMessageIds) {
            try {
                await this.ctx.deleteMessage(messageId);
            } catch (error) {
                console.error(`Failed to delete message ${messageId}:`, error.message);
                await this.logger.e("clearMessages", error.message)
            }
        }
        this.sentMessageIds = [];
    }
}
