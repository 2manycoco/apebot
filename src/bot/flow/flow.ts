import {Context} from "telegraf";
import {Logger} from "../../utils/logger";
import AnalyticsService from "../../analytics/analytics_service";
import {ActionValues, TemplateActionValues} from "../actions";
import {UserManager} from "../user_manager";
import {Message} from "@telegraf/types";
import {FlowValues} from "./flow_ids";
import {retry, retryAll} from "../../utils/call_helper";

export abstract class Flow {
    protected userId: number;
    protected ctx: Context;
    protected logger: Logger;
    protected analytics: AnalyticsService;
    protected userManager: UserManager;
    private sentMessageIds: number[] = [];
    private readonly onCompleteCallback?: (flowId: string) => void;

    protected constructor(ctx: Context, userId: number, onCompleteCallback?: (flowId: string) => void) {
        this.userId = userId;
        this.ctx = ctx;
        this.logger = Logger.getInstance();
        this.analytics = AnalyticsService.getInstance();
        this.userManager = new UserManager(ctx, userId);
        this.onCompleteCallback = onCompleteCallback;
    }

    /**
     * Called when the Flow is started.
     */
    public abstract start(): Promise<void>;

    /**
     * Handles callback actions for buttons during the Flow.
     * @param action The action string received from the button callback.
     */
    public async handleAction(action: ActionValues): Promise<boolean> {
        const result = await this.handleActionInternal(action)
        await this.checkFinished()
        return Promise.resolve(result)
    }

    public abstract handleActionInternal(action: ActionValues): Promise<boolean>;

    public async handleTemplateAction(action: TemplateActionValues): Promise<boolean> {
        const result = await this.handleTemplateActionInternal(action)
        await this.checkFinished()
        return Promise.resolve(result)
    }

    public handleTemplateActionInternal(action: TemplateActionValues): Promise<boolean> {
        return Promise.resolve(false)
    }

    /**
     * Handles user input during the Flow.
     * @param message The message or input from the user.
     */
    public async handleMessage(message: string): Promise<boolean> {
        const result = await this.handleMessageInternal(message)
        await this.checkFinished()
        return Promise.resolve(result)
    }

    public abstract handleMessageInternal(message: string): Promise<boolean>;

    private async checkFinished() {
        if (this.isFinished()) {
            await this.cleanup()
            if (this.onCompleteCallback) {
                this.onCompleteCallback(this.getFlowId());
            }
        }
    }

    protected abstract isFinished(): boolean;

    /**
     * Cleans up the Flow if the user cancels it or completes it.
     */
    public async cleanup(): Promise<void> {
        await this.clearMessages()
    }

    /**
     * Returns the identifier of the Flow.
     */
    public abstract getFlowId(): FlowValues

    protected async handleMessageResponse(
        sendAction: () => Promise<Message>
    ): Promise<void> {
        const message = await sendAction();
        if (message?.message_id) {
            this.sentMessageIds.push(message.message_id);
        }
    }

    protected async clearMessages(): Promise<void> {
        for (const messageId of this.sentMessageIds) {
            try {
                await retryAll(
                    async () => await this.ctx.deleteMessage(messageId), 5
                );
            } catch (error) {
                console.error(`Failed to delete message ${messageId}:`, error.message);
                await this.logger.e("clearMessages", error.message);
            }
        }
        this.sentMessageIds = [];
    }
}

