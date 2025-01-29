import {
    Entity,
    PrimaryColumn,
    Column,
    PrimaryGeneratedColumn,
    Index,
    CreateDateColumn,
    ManyToOne,
    JoinColumn
} from "typeorm";

@Entity("users")
export class User {
    @PrimaryColumn("bigint", {name: "telegram_id", nullable: false})
    telegramId: number = 0;

    @Column("varchar", {length: 255, name: "wallet_pk", nullable: false})
    walletPK: string = "";

    @Column("varchar", {length: 255, name: "wallet_address", nullable: false})
    walletAddress: string = "";

    @Column("bool", {name: "accepted_terms", default: false})
    acceptedTerms: boolean = false;

    @Column("decimal", {name: "slippage", default: 1.0})
    slippage: number = 1.0;
}

@Entity("transactions")
export class Transaction {
    @PrimaryGeneratedColumn("uuid", {name: "transaction_id"})
    transactionId: string;

    @Column("bigint", {name: "user_id", nullable: false})
    @Index()
    userId: number = 0;

    @Column("varchar", {length: 66, name: "asset_id_in", nullable: false})
    assetIdIn: string = "";

    @Column("decimal", {precision: 18, scale: 8, name: "amount_in", nullable: false})
    amountIn: number = 0;

    @Column("varchar", {length: 66, name: "asset_id_out", nullable: false})
    assetIdOut: string = ""; // Адрес монеты, которая получается в результате обмена

    @Column("decimal", {precision: 18, scale: 8, name: "amount_out", nullable: false})
    amountOut: number = 0;

    @Column("bigint", {name: "timestamp", nullable: false})
    timestamp: number = 0;
}

@Entity("positions")
export class Position {
    @PrimaryGeneratedColumn("uuid", {name: "position_id"})
    positionId: string;

    @ManyToOne(() => Transaction)
    @JoinColumn({name: "transaction_id"})
    transaction: Transaction;

    @Column("bigint", {name: "user_id", nullable: false})
    @Index()
    userId: number;

    @Column("bigint", {name: "timestamp", nullable: false})
    timestamp: number = 0;
}

export enum LogLevel {
    INFO = "INFO",
    ERROR = "ERROR",
}

@Entity("logs")
export class Log {
    @PrimaryGeneratedColumn("uuid", {name: "log_id"})
    logId: string;

    @CreateDateColumn({name: "timestamp"})
    timestamp: Date;

    @Column("varchar", {length: 50, name: "tag"})
    tag: string;

    @Column("text", {name: "message"})
    message: string;

    @Column("enum", {enum: LogLevel, name: "level"})
    level: LogLevel;
}