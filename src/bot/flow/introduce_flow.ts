import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {Actions, ActionValues} from "../actions";
import {FlowId, FlowValues} from "./flow_ids";
import {Images} from "../resources/images";
import {Strings} from "../resources/strings";

export class IntroduceFlow extends Flow {

    private isUserAccept = false

    constructor(ctx: Context, userId: number, onCompleteCallback?: (flowId: string) => void) {
        super(ctx, userId, onCompleteCallback);
    }

    getFlowId(): FlowValues {
        return FlowId.INTRO_FLOW;
    }

    public async start(): Promise<void> {
        await this.handleMessageResponse(async () => {
            return await this.ctx.replyWithPhoto(
                {url: Images.APE_LOGO_WIDE},
                {
                    caption: Strings.INTRODUCE_TEXT,
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([
                        Markup.button.callback(Strings.BUTTON_CONTINUE, Actions.CONTINUE),
                    ]),
                }
            )
        })
    }

    public async handleActionInternal(action: ActionValues): Promise<boolean> {
        switch (action) {
            case Actions.CONTINUE:
                await this.userManager.acceptTerms();
                this.isUserAccept = true
                return Promise.resolve(true);
            default:
                return Promise.resolve(false);
        }
    }

    public handleMessageInternal(message: string): Promise<boolean> {
        return Promise.resolve(false);
    }

    isFinished(): boolean {
        return this.isUserAccept;
    }
}