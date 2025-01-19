import {Logger} from "../utils/logger";
import AnalyticsService from "../analytics/analytics_service";
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
            await trackUserAnalytics(this.ctx, "user_terms_accepted")
        } catch (error) {
            await this.logger.e("terms_accept_error", error.message)
        }
    }
}