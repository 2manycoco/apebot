import { Repository } from "typeorm";
import { Log } from "./entities";
import { AppDataSource } from "./database";
import {TransactionMapStorage, TransactionRepository, TransactionStorage} from "./transaction_repository";

export interface LogRepository {
    saveLog(log: Log): Promise<void>;
    getAllLogs(): Promise<Log[]>;
}

export class LogStorage implements LogRepository{
    private static instance: LogStorage;
    private logRepository: Repository<Log>;

    private constructor() {
        this.logRepository = AppDataSource.getRepository(Log);
    }

    public static getInstance(): LogStorage {
        if (!LogStorage.instance) {
            LogStorage.instance = new LogStorage();
        }
        return LogStorage.instance;
    }

    async saveLog(log: Log): Promise<void> {
        await this.logRepository.save(log);
    }

    async getAllLogs(): Promise<Log[]> {
        return await this.logRepository.find();
    }
}

export function getLogRepository(): LogRepository {
    return LogStorage.getInstance()
}