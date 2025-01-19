import {LogStorage} from "../database/log_repository";
import {Log, LogLevel} from "../database/entities";
import AnalyticsService from "../analytics/analytics_service";


export class Logger {
    private static instance: Logger;
    private logRepository: LogStorage;
    private analytics:  AnalyticsService

    private constructor() {
        this.logRepository = LogStorage.getInstance();
        this.analytics =  AnalyticsService.getInstance();
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    async e(tag: string, message: string): Promise<void> {
        console.error(tag, message);
        await this.analytics.trackError(tag, message)

        const log = this.createLog(LogLevel.ERROR, tag, message)
        await this.saveLog(log)
    }

    async i(tag: string, message: string): Promise<void> {
        console.info(tag, message);
        const log = this.createLog(LogLevel.INFO, tag, message)
        await this.saveLog(log)
    }

    private createLog(level: LogLevel, tag: string, message: string): Log {
        const log = new Log();
        log.tag = tag;
        log.message = message;
        log.level = level;
        return log
    }

    private async saveLog(log: Log) {
        try {
            //await this.logRepository.saveLog(log);
        } catch (error) {
            console.error("Failed to save info log:", error.message);
        }
    }
}
