import {Flow} from "./flow";
import {Context} from "telegraf";
import {ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {replySettingsMenu} from "../session_message_builder";

export class SettingsMenuFlow extends Flow {

    constructor(ctx: Context, userId: number, onCompleteCallback?: (flowId: string, successful: Boolean) => void) {
        super(ctx, userId, onCompleteCallback);
    }

    getFlowId(): FlowValues {
        return FlowId.SETTINGS_FLOW;
    }

    public async start(): Promise<void> {
        await this.handleMessageResponse(async () => {
            return await replySettingsMenu(this.ctx)
        });
    }

    isFinished(): boolean {
        return true;
    }

    handleActionInternal(action: ActionValues): Promise<boolean> {
        return Promise.resolve(false);
    }

    handleMessageInternal(message: string): Promise<boolean> {
        return Promise.resolve(false);
    }
}
