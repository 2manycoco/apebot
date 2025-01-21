// This file contains all possible user actions for the Telegram bot

export const Commands = {
    START: "start", // Command to start the bot
    ABOUT: "about", // Command to show help information
    DOCS: "docs", // Command to show help information
} as const;

export type CommandKeys = keyof typeof Commands;
export type CommandValues = typeof Commands[CommandKeys];

export const Actions = {
    INTRO_ACCEPT: "ACCEPT_TERMS",

    MAIN_BALANCE: "MAIN_BALANCE",
    MAIN_WITHDRAW_FUNDS: "MAIN_WITHDRAW_FUNDS",
    MAIN_VIEW_POSITIONS: "MAIN_VIEW_POSITIONS",
    MAIN_BUY: "MAIN_BUY",
    MAIN_WALLET_PK: "MAIN_WALLET_PK"
} as const;

export type ActionKeys = keyof typeof Actions;
export type ActionValues = typeof Actions[ActionKeys];
