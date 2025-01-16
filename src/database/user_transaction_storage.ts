import {Transaction} from "./entities";
import {Repository} from "typeorm";
import {AppDataSource} from "./database";
import dotenv from "dotenv";

dotenv.config();

export interface TransactionRepository {
    addTransaction(transaction: Transaction): Promise<void>;
    getUserTransactions(userId: number): Promise<Transaction[]>;
}

export class TransactionStorage implements TransactionRepository {
    private static instance: TransactionStorage;
    private transactionRepository: Repository<Transaction>;

    private constructor() {
        this.transactionRepository = AppDataSource.getRepository(Transaction);
    }

    public static getInstance(): TransactionStorage {
        if (!TransactionStorage.instance) {
            TransactionStorage.instance = new TransactionStorage();
        }
        return TransactionStorage.instance;
    }

    async addTransaction(transaction: Transaction): Promise<void> {
        await this.transactionRepository.save(transaction);
    }

    async getUserTransactions(userId: number): Promise<Transaction[]> {
        return await this.transactionRepository.findBy({ userId });
    }
}

export class TransactionMapStorage implements TransactionRepository {
    private static instance: TransactionMapStorage;
    private transactions: Map<string, Transaction>;

    private constructor() {
        this.transactions = new Map<string, Transaction>();
    }

    public static getInstance(): TransactionRepository {
        if (!TransactionMapStorage.instance) {
            TransactionMapStorage.instance = new TransactionMapStorage();
        }
        return TransactionMapStorage.instance;
    }

    async addTransaction(transaction: Transaction): Promise<void> {
        this.transactions.set(transaction.transactionId, transaction);
    }

    async getUserTransactions(userId: number): Promise<Transaction[]> {
        return Array.from(this.transactions.values()).filter(tx => tx.userId === userId);
    }
}
export function getTransactionRepository(): TransactionRepository {
    if (process.env.USE_LOCAL_STORAGE) {
        return TransactionMapStorage.getInstance()
    } else {
        return TransactionStorage.getInstance()
    }
}

