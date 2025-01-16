// This file contains all possible user actions for the Telegram bot

export const Commands = {
    START: "start", // Command to start the bot
    ABOUT: "about", // Command to show help information
};

export type CommandKeys = keyof typeof Commands;

export const Actions = {
    VIEW_BALANCE: "VIEW_BALANCE", // Action for viewing user balance
    SWAP_ASSET: "SWAP_ASSET", // Action for swapping one asset to another
    WITHDRAW_FUNDS: "WITHDRAW_FUNDS", // Action for withdrawing funds to a wallet
    VIEW_WALLET_ADDRESS: "VIEW_WALLET_ADDRESS", // Action for viewing the internal wallet address
    VIEW_POSITIONS: "VIEW_POSITIONS", // Action for viewing PNL and user positions
};

export type ActionKeys = keyof typeof Actions;