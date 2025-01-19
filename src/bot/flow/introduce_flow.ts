import {Flow} from "./flow";
import {Context, Markup} from "telegraf";
import {ActionKeys, Actions, ActionValues} from "../actions";


export class IntroduceFlow extends Flow {

    private isUserAccept = false

    constructor(ctx: Context, userId: number) {
        super(ctx, userId);
    }

    public async start(): Promise<void> {
        await this.handleMessageResponse(async () => {
            return await this.ctx.replyWithPhoto(
                {url: "https://wallpapers.com/images/featured-full/funny-old-man-pictures-29zq8pp6pi1gcap8.jpg"}, // Replace with your image URL
                {
                    caption: `This is the start message. Check this link: [LinkedIn](https://www.linkedin.com/in/antiglobalist/)`,
                    parse_mode: "Markdown",
                    ...Markup.inlineKeyboard([
                        Markup.button.callback("Accept", Actions.INTRO_ACCEPT),
                    ]),
                }
            )
        })
    }

    public async handleAction(action: ActionValues): Promise<boolean> {
        switch (action) {
            case Actions.INTRO_ACCEPT:
                await this.userManager.acceptTerms();
                this.isUserAccept = true
                return Promise.resolve(true);
            default:
                return Promise.resolve(false);
        }
    }

    public handleMessage(message: string): Promise<boolean> {
        return Promise.resolve(undefined);
    }

    isFinished(): boolean {
        return this.isUserAccept;
    }

    public cleanup(): Promise<void> {
        return Promise.resolve(undefined);
    }
}