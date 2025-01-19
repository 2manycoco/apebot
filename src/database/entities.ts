import {Entity, PrimaryColumn, Column, PrimaryGeneratedColumn, Index, CreateDateColumn} from "typeorm";

@Entity()
export class User  {
    @PrimaryColumn("bigint", { name: "telegram_id", nullable: false })
    telegramId: number = 0;

    @Column("varchar", { length: 255, name: "wallet_pk", nullable: false })
    walletPK: string = "";

    @Column("varchar", { length: 255, name: "wallet_address", nullable: false })
    walletAddress: string = "";

    @Column("bool", { name: "accepted_terms", default: false })
    acceptedTerms: boolean = false;

    @Column("decimal", { name: "slippage", default: 0.5 })
    slippage: number = 0.5;
}

@Entity("transactions")
export class Transaction {
    @PrimaryGeneratedColumn("uuid", { name: "transaction_id" })
    transactionId: string = "";

    @Column("bigint", { name: "user_id", nullable: false })
    @Index()
    userId: number = 0;

    @Column("varchar", { length: 10, name: "symbol_from", nullable: false })
    symbolFrom: string = "";

    @Column("decimal", { precision: 18, scale: 8, name: "amount_from", nullable: false })
    amountFrom: number = 0;

    @Column("varchar", { length: 10, name: "symbol_to", nullable: false })
    symbolTo: string = "";

    @Column("decimal", { precision: 18, scale: 8, name: "amount_to", nullable: false })
    amountTo: number = 0;

    @Column("bigint", { name: "timestamp", nullable: false })
    timestamp: number = 0;
}

export enum LogLevel {
    INFO = "INFO",
    ERROR = "ERROR",
}

@Entity("logs")
export class Log {
    @PrimaryGeneratedColumn("uuid", { name: "log_id" })
    logId: string;

    @CreateDateColumn({ name: "timestamp" })
    timestamp: Date;

    @Column("varchar", { length: 50, name: "tag" })
    tag: string;

    @Column("text", { name: "message" })
    message: string;

    @Column("enum", { enum: LogLevel, name: "level" })
    level: LogLevel;
}