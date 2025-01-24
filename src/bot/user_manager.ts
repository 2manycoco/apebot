import {Logger} from "../utils/logger";
import {getUserRepository, UserRepository} from "../database/user_repository";
import {Context} from "telegraf";
import {trackUserAnalytics} from "./user_analytics";

export class UserManager {
    private userId: number;
    private ctx: Context;
    private logger: Logger
    private userRepository: UserRepository

    constructor(ctx: Context, userId: number) {
        this.userId = userId;
        this.ctx = ctx;
        this.userRepository = getUserRepository()
        this.logger = Logger.getInstance()
    }

    async isAcceptTerms(){
        const user = await this.userRepository.getUserById(this.userId)
        return user.acceptedTerms
    }

    async acceptTerms() {
        try {
            await this.userRepository.updateAcceptedTerms(this.userId, true);
            trackUserAnalytics(this.ctx, "user_terms_accepted")
        } catch (error) {
            await this.logger.e("terms_accept_error", error.message)
        }
    }

    async getSlippage(): Promise<number> {
        try {
            const user = await this.userRepository.getUserById(this.userId);
            return user.slippage ?? 0;
        } catch (error) {
            await this.logger.e("get_slippage_error", error.message);
            throw new Error("Failed to get slippage");
        }
    }

    async saveSlippage(newSlippage: number): Promise<void> {
        try {
            const user = await this.userRepository.getUserById(this.userId);
            user.slippage = newSlippage;
            await this.userRepository.saveUser(user);
        } catch (error) {
            await this.logger.e("save_slippage_error", error.message);
            throw new Error("Failed to save slippage");
        }
    }
}