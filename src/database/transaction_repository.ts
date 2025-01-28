import {Transaction} from "./entities";
import {Repository} from "typeorm";
import {AppDataSource} from "./database";

export class TransactionStorage {
    private static instance: TransactionStorage;
    transactionRepository: Repository<Transaction>;

    private constructor() {
        this.transactionRepository = AppDataSource.getRepository(Transaction);
    }

    public static getInstance(): TransactionStorage {
        if (!TransactionStorage.instance) {
            TransactionStorage.instance = new TransactionStorage();
        }
        return TransactionStorage.instance;
    }

    async addTransaction(transaction: Transaction): Promise<Transaction> {
        return await this.transactionRepository.save(transaction);
    }

    async getUserTransactions(userId: number): Promise<Transaction[]> {
        return await this.transactionRepository.findBy({userId});
    }
}

export function getTransactionRepository(): TransactionStorage {
    return TransactionStorage.getInstance()
}

