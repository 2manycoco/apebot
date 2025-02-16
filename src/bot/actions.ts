// This file contains all possible user actions for the Telegram bot
export const Commands = {
    START: "start", //Open the main menu
    POSITIONS: "positions", //View active trading positions and PnL
    BUY: "buy", //Buy tokens
    SELL: "sell", //Sell your tokens
    INFO: "info", //Open documentation and details
} as const;

export type CommandKeys = keyof typeof Commands;
export type CommandValues = typeof Commands[CommandKeys];

export const Actions = {
    CANCEL: "CANCEL",
    ACCEPT: "ACCEPT",
    CONFIRM: "CONFIRM",
    CONTINUE: "CONTINUE",
    LOADING: "LOADING",
    PERCENT_25: "25%",
    PERCENT_50: "50%",
    PERCENT_100: "100%",
    AMOUNT_0_002: "AMOUNT_0_002",
    AMOUNT_0_005: "AMOUNT_0_005",
    AMOUNT_0_01: "AMOUNT_0_01",
    AMOUNT_500: "AMOUNT_500",
    AMOUNT_1000: "AMOUNT_1000",
    AMOUNT_1500: "AMOUNT_1500",
    SHOW_MORE: "SHOW_MORE",

    MAIN_WALLET: "MAIN_WALLET",
    MAIN_WITHDRAW_FUNDS: "MAIN_WITHDRAW_FUNDS",
    MAIN_VIEW_POSITIONS: "MAIN_VIEW_POSITIONS",
    MAIN_BUY: "MAIN_BUY",
    MAIN_SELL: "MAIN_SELL",
    MAIN_WALLET_PK: "MAIN_WALLET_PK",
    MAIN_SLIPPAGE: "MAIN_SLIPPAGE",

    SLIPPAGE_0_1: "SLIPPAGE_0_1",
    SLIPPAGE_0_5: "SLIPPAGE_0_5",
    SLIPPAGE_1: "SLIPPAGE_1"
} as const;

export type ActionKeys = keyof typeof Actions;
export type ActionValues = typeof Actions[ActionKeys];

export const TemplateActions = {
    BUY: (symbol: string) => `BUY:${symbol}`,
    SELL: (symbol: string, percentage?: number) => `SELL:${symbol}${percentage !== undefined ? `:${percentage}` : ""}`,
    WITHDRAW: (symbol: string) => `WITHDRAW:${symbol}`,
    REFRESH: (id: number) => `REFRESH:${id}`,
    HIDE: (id: number) => `HIDE:${id}`,

    parse: (action: string): TemplateActionValues | null => {
        const pattern = /^(BUY|SELL|REFRESH|HIDE|WITHDRAW):([^:]+)(?::(\d+))?$/;
        const match = action.match(pattern);
        if (match) {
            const [_, type, symbolOrId, percentage] = match;

            if (type === "REFRESH" || type === "HIDE") {
                return {type: type as TemplateActionKeys, id: parseInt(symbolOrId)};
            }

            return {
                type: type as TemplateActionKeys,
                symbol: symbolOrId,
                percentage: percentage ? parseInt(percentage, 10) : undefined,
            };
        }
        return null;
    },
} as const;

export type TemplateActionKeys = "BUY" | "SELL" | "REFRESH" | "HIDE" | "WITHDRAW";
export type TemplateActionValues = {
    type: TemplateActionKeys;
    symbol?: string;
    id?: number;
    percentage?: number;
};
