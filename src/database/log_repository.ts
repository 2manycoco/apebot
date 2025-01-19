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

export class InMemoryLogStorage implements LogRepository {
    private static instance: InMemoryLogStorage;
    private logs: Map<string, Log> = new Map();

    private constructor() {}

    public static getInstance(): InMemoryLogStorage {
        if (!InMemoryLogStorage.instance) {
            InMemoryLogStorage.instance = new InMemoryLogStorage();
        }
        return InMemoryLogStorage.instance;
    }

    async saveLog(log: Log): Promise<void> {
        this.logs.set(log.logId, log); // Assuming `logId` is a unique identifier
    }

    async getAllLogs(): Promise<Log[]> {
        return Array.from(this.logs.values());
    }
}

export function getLogRepository(): LogRepository {
    if (process.env.USE_LOCAL_STORAGE === "false") {
        return LogStorage.getInstance()
    } else {
        return InMemoryLogStorage.getInstance()
    }
}