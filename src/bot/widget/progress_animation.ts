import {Context} from "telegraf";
import {Logger} from "../../utils/logger";

export class ProgressAnimation {
    private progressFrames = [
        " ●",
        " ● ●",
        " ● ● ●",
        " ● ● ● ●",
        " ● ● ● ● ●",
    ];
    private messageId: number | undefined;
    private intervalId: NodeJS.Timeout | undefined;

    constructor(private ctx: Context) { }

    // Start the animation
    public async startAnimation(): Promise<void> {
        this.messageId = (await this.ctx.reply(`${this.progressFrames[0]}`)).message_id;

        let frameIndex = 0;
        this.intervalId = setInterval(async () => {
            try {
                if(!this.intervalId) return
                frameIndex = (frameIndex + 1) % this.progressFrames.length;
                await this.ctx.telegram.editMessageText(
                    this.ctx.chat.id,
                    this.messageId!,
                    undefined,
                    `${this.progressFrames[frameIndex]}`
                );
            } catch (e) {
                await Logger.getInstance().e("edit_progress_message", e.message)
            }
        }, 1000);
    }

    // Stop the animation
    public async stopAnimation(): Promise<void> {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }

        try {
            if (this.messageId) {
                await this.ctx.deleteMessage(this.messageId);
            }
        } catch(e){
            await Logger.getInstance().e("delete_progress_message", e.message)
        }
    }
}
