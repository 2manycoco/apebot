import {Brackets, Repository} from "typeorm";
import {Position, Transaction} from "./entities";
import { AppDataSource } from "./database";
import {getTransactionRepository} from "./transaction_repository";

export interface PositionRepository {
    addPosition(position: Position): Promise<Position>;
    deletePosition(positionId: string): Promise<void>;
    getPosition(positionId: string): Promise<Position | null>;
    getPositionsByUser(userId: number): Promise<Position[]>;
    findPositionByPair(userId: number, assetIdIn: string, assetIdOut: string): Promise<Position | null>;
    getTransactions(positionId: string): Promise<Transaction[]>;
}

export class PositionStorage implements PositionRepository {
    private static instance: PositionStorage;
    private positionRepository: Repository<Position>;

    private constructor() {
        this.positionRepository = AppDataSource.getRepository(Position);
    }

    public static getInstance(): PositionStorage {
        if (!PositionStorage.instance) {
            PositionStorage.instance = new PositionStorage();
        }
        return PositionStorage.instance;
    }

    async addPosition(position: Position): Promise<Position> {
        return await this.positionRepository.save(position);
    }

    async deletePosition(positionId: string): Promise<void> {
        await this.positionRepository.delete({positionId});
    }

    async getPosition(positionId: string): Promise<Position | null> {
        return await this.positionRepository.findOne({
            where: { positionId },
            relations: ["transaction"],
        });
    }

    async getPositionsByUser(userId: number): Promise<Position[]> {
        return await this.positionRepository.find({
            where: { userId },
            relations: ["transaction"],
            order: { timestamp: "DESC" },
        });
    }

    async findPositionByPair(userId: number, assetIdIn: string, assetIdOut: string): Promise<Position | null> {
        const position = await this.positionRepository
            .createQueryBuilder("position")
            .innerJoinAndSelect("position.transaction", "transaction")
            .where("position.userId = :userId", { userId })
            .andWhere("transaction.assetIdIn = :assetIdIn", { assetIdIn })
            .andWhere("transaction.assetIdOut = :assetIdOut", { assetIdOut })
            .getOne();

        return position || null;
    }

    async getTransactions(positionId: string): Promise<Transaction[]> {
        const position = await this.positionRepository.findOne({
            where: { positionId },
            relations: ["transaction"],
        });

        if (!position) {
            throw new Error("Position not found");
        }

        const initialTransaction = position.transaction;

        return await getTransactionRepository().transactionRepository
            .createQueryBuilder("transaction")
            .where("transaction.userId = :userId", { userId: position.userId })
            .andWhere(
                new Brackets((qb) => {
                    qb.where("transaction.assetIdIn = :trackedAsset AND transaction.assetIdOut = :targetAsset", {
                        trackedAsset: initialTransaction.assetIdIn,
                        targetAsset: initialTransaction.assetIdOut,
                    }).orWhere("transaction.assetIdIn = :targetAsset AND transaction.assetIdOut = :trackedAsset", {
                        trackedAsset: initialTransaction.assetIdIn,
                        targetAsset: initialTransaction.assetIdOut,
                    });
                })
            )
            .andWhere("transaction.timestamp >= :timestamp", { timestamp: initialTransaction.timestamp })
            .orderBy("transaction.timestamp", "ASC")
            .getMany();
    }
}

export function getPositionRepository(): PositionRepository {
    return PositionStorage.getInstance()
}