export const Strings = {
    MENU_TEXT: `
*Wallet:* \`%s\`

*Balance:* \`%s %s\`
`,
    MENU_BUTTON_POSITIONS: "📈 Positions",
    MENU_BUTTON_BALANCE: "💰 Balance",
    MENU_BUTTON_BUY: "💸 BUY",
    MENU_BUTTON_WITHDRAW: "⬆️ Withdraw",
    MENU_BUTTON_SLIPPAGE: "⚙️ Slippage",
    MENU_BUTTON_WALLET_PK: "🔑 Wallet PK",

    BALANCE_TEXT: `
%s    
    
*Total:* \`%s %s \`
`,
    WALLET_PK_TEXT: `
*Wallet PK:* \`%s\`
`,

    INVALID_ADDRESS_TEXT: "Invalid address",
    BUTTON_CANCEL: "Cancel",
    BUTTON_ACCEPT: "Accept",

    PERCENT_0_1: "0.1%",
    PERCENT_0_5: "0.5%",
    PERCENT_1: "1%",
    PERCENT_25: "25%",
    PERCENT_50: "50%",
    PERCENT_100: "100%",

    INTRODUCE_TEXT: `This is the start message. Check this link: [LinkedIn](https://www.linkedin.com/in/antiglobalist/)`,

    WITHDRAW_INPUT_TEXT: "Enter your Fuel wallet address to withdraw ETH:",
    WITHDRAW_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to withdraw.",
    WITHDRAW_SUCCESS_TEXT: "Funds have been successfully withdrawn.",
    WITHDRAW_AMOUNT_TEXT: "Specify how much to withdraw or enter a percentage.",
    WITHDRAW_PERCENTAGE_ERROR: "Invalid percentage. Please enter a value between 1 and 100.",

    SET_SLIPPAGE_START_TEXT: "Current value: %s%. Choose a slippage percentage or enter your own.",
    SET_SLIPPAGE_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 0 and 75.",
    SET_SLIPPAGE_SUCCESS: "Slippage successfully set to %s%.",

    SELL_START_TEXT: "Balance: %s %s. Specify the percentage to sell or choose one of the options.",
    SELL_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to sell.",
    SELL_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 1 and 100.",
    SELL_SUCCESS: "Successfully sold.",
} as const;

export function formatMessage(template: string, ...args: any[]): string {
    return template.replace(/%s/g, () => args.shift());
}