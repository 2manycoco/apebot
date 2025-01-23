// This file contains all possible user actions for the Telegram bot

export const Commands = {
    START: "start", // Command to start the bot
    ABOUT: "about", // Command to show help information
    DOCS: "docs", // Command to show help information
} as const;

export type CommandKeys = keyof typeof Commands;
export type CommandValues = typeof Commands[CommandKeys];

export const Actions = {
    CANCEL: "CANCEL",
    ACCEPT: "ACCEPT",
    CONTINUE: "CONTINUE",
    PERCENT_25: "25%",
    PERCENT_50: "50%",
    PERCENT_100: "100%",

    MAIN_BALANCE: "MAIN_BALANCE",
    MAIN_WITHDRAW_FUNDS: "MAIN_WITHDRAW_FUNDS",
    MAIN_VIEW_POSITIONS: "MAIN_VIEW_POSITIONS",
    MAIN_BUY: "MAIN_BUY",
    MAIN_WALLET_PK: "MAIN_WALLET_PK",
    MAIN_SLIPPAGE: "MAIN_SLIPPAGE",

    SLIPPAGE_0_1: "SLIPPAGE_0_1",
    SLIPPAGE_0_5: "SLIPPAGE_0_5",
    SLIPPAGE_1: "SLIPPAGE_1"
} as const;

export type ActionKeys = keyof typeof Actions;
export type ActionValues = typeof Actions[ActionKeys];
