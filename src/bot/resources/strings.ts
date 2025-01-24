import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});


export const Strings = {
    INTRODUCE_TEXT: `
    Thank you for choosing us, and welcome onboard to the first trading bot on Fuel! 🚀

By pressing the *Continue* button, your internal wallet will be generated. This wallet is secure as long as you store your secret phrase in a safe place—never share it with anyone.

By using this bot, you agree to our [Terms and Conditions](https://tricky-coconut.gitbook.io/ape-bot-on-fuel/terms-and-conditions) and the Terms of Use for [Telegram Mini Apps](https://telegram.org/tos/mini-apps).  
For more details, feel free to explore our [📖 ApeBot Documentation](${process.env.DOC_URL}).

If you have any questions, reach out to us:

Twitter: [@apebotonfuel](${process.env.TWITTER_URL})  
Telegram Group: [t.me/apebotfuel](${process.env.TELEGRAM_URL})`,

    MENU_TEXT: `
*Wallet:* \`%s\`

*Balance:* \`%s %s\``,
    MENU_BUTTON_POSITIONS: "📈 Positions",
    MENU_BUTTON_BALANCE: "💰 Balance",
    MENU_BUTTON_BUY: "💸 BUY",
    MENU_BUTTON_SELL: "💲 SELL",
    MENU_BUTTON_WITHDRAW: "⬆️ Withdraw",
    MENU_BUTTON_SLIPPAGE: "⚙️ Slippage",
    MENU_BUTTON_WALLET_PK: "🔑 Wallet PK",

    BALANCE_TEXT: `
%s    
    
*Total:* \`%s %s \`
`,
    WALLET_PK_TEXT: `
*Wallet PK:* \`%s\``,

    INVALID_ADDRESS_TEXT: "Invalid address",
    BUTTON_CANCEL: "Cancel",
    BUTTON_ACCEPT: "Accept",
    BUTTON_CONTINUE: "Continue",

    PERCENT_0_1: "0.1%",
    PERCENT_0_5: "0.5%",
    PERCENT_1: "1%",
    PERCENT_25: "25%",
    PERCENT_50: "50%",
    PERCENT_100: "100%",

    AMOUNT_0_002: "0.002 ETH",
    AMOUNT_0_005: "0.005 ETH",
    AMOUNT_0_01: "0.01 ETH",

    WITHDRAW_INPUT_TEXT: `
Balance: %s %s
Enter your Fuel wallet address to withdraw:`,
    WITHDRAW_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to withdraw.",
    WITHDRAW_SUCCESS_TEXT: "Funds have been successfully withdrawn.",
    WITHDRAW_AMOUNT_TEXT: "Specify how much to withdraw or enter 100%.",
    WITHDRAW_PERCENTAGE_ERROR: "Invalid percentage. Please enter a value between 1 and 100.",
    WITHDRAW_AMOUNT_ERROR: "Insufficient funds for withdrawal",
    WITHDRAW_INPUT_AMOUNT_ERROR: "Invalid input",

    SET_SLIPPAGE_START_TEXT: "Current value: %s%. Choose a slippage percentage or enter your own.",
    SET_SLIPPAGE_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 0 and 75.",
    SET_SLIPPAGE_SUCCESS: "Slippage successfully set to %s%.",

    SWAP_START_TEXT: `
*Swap %s -> %s*

Available: *%s* %s (%s %s)`,
    SWAP_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to swap.",
    SWAP_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 1 and 100.",
    SWAP_CONFIRMATION_TEXT: "*%s %s* -> *%s %s*",
    SWAP_SUCCESS: "Transaction completed successfully!",

    BUY_ENTER_ASSET: "Please enter the contract address of the token you want to buy:",
    BUY_ENTER_ASSET_ERROR: "Invalid contract address. Please try again.",
    BUY_START_TEXT: `
Token: *%s* (%s USDC)
Available: *%s ETH*

Enter the amount to spend or choose from the options below:`,
    BUY_AMOUNT_ERROR: "Invalid amount. Please enter a valid amount of ETH less than or equal to your balance.",
    BUY_CONFIRMATION_TEXT: "*%s ETH* -> *%s %s*.\n\nDo you want to proceed?",
    BUY_SUCCESS: "Transaction completed successfully!",
    BUY_INSUFFICIENT_FUNDS_TEXT: "You have insufficient ETH to make a purchase.",

    SELL_NO_ASSETS_TEXT: "You don't have any assets available for sale.",
    SELL_START_TEXT_ASSET: "*Available Assets for Sale*\n\n%s\n\nSelect the asset you want to sell:",
    SELL_ASSET_BALANCE_TEXT: "Select the asset you want to sell:",
    SELL_SELECT_ASSET_ERROR: "Invalid Asset Selected.",
    SELL_SOMETHING_WRONG_TEXT: "Something went wrong.",
    SELL_ENTER_PERCENTAGE: "Selected asset: *%s*\n\nEnter the percentage of your %s to sell or select below:",
    SELL_CONFIRMATION_TEXT: "*%s %s* -> *%s %s*.\n\nDo you want to proceed?",
    SELL_PERCENTAGE_ERROR: "Invalid percentage. Please enter a value between 1 and 100.",
    SELL_SUCCESS: "Successfully sold!",
} as const;

export function formatMessage(template: string, ...args: any[]): string {
    return template.replace(/%s/g, () => args.shift());
}