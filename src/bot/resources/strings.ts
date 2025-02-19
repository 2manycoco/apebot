import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});


export const Strings = {
    INTRODUCE_TEXT: `
    Thank you for choosing us, and welcome onboard to the first trading bot on Fuel! 🚀

By pressing the *Continue* button, your internal wallet will be generated. This wallet is secure as long as you store your secret phrase in a safe place—never share it with anyone.

By using this bot, you agree to our [Terms and Conditions](${process.env.TERMS_URL}) and the Terms of Use for [Telegram Mini Apps](https://telegram.org/tos/mini-apps).  
For more details, feel free to explore our [📖 ApeBot Documentation](${process.env.DOC_URL}).

If you have any questions, reach out to us:

Twitter: [@apebotonfuel](${process.env.TWITTER_URL})  
Telegram Group: [t.me/apebotfuel](${process.env.TELEGRAM_URL})`,

    MENU_TEXT: `
*Wallet:* \`%s\`

%s

*Trade balances:* \n\`%s\``,

    MENU_SETTINGS_TEXT: `Choose the settings you want to change?`,

    MENU_BUTTON_POSITIONS: "📈 Positions",
    MENU_BUTTON_WALLET: "💰 Wallet",
    MENU_BUTTON_BUY: "💸 BUY",
    MENU_BUTTON_SELL: "💲 SELL",
    MENU_BUTTON_WITHDRAW: "⬆️ Withdraw",
    MENU_BUTTON_SETTINGS: "⚙️ Settings",
    MENU_BUTTON_SLIPPAGE: "% Slippage",
    MENU_BUTTON_ALERTS: "🔔 Alerts",
    MENU_BUTTON_WALLET_PK: "🔑 Wallet PK",

    BALANCE_TEXT: `
%s    
    
*Total:* \`%s %s \`
`,
    WALLET_PK_TEXT: `*Wallet PK:*
_\\(This message will auto\\-delete in 30 seconds\\)_
     
||%s||`,
    UNBOUNDED_ASSETS_LABEL: "Unbounded:",

    INVALID_ADDRESS_TEXT: "Invalid address",
    BUTTON_CANCEL: "Cancel",
    BUTTON_ACCEPT: "Accept",
    BUTTON_CONFIRM: "Confirm",
    BUTTON_CONTINUE: "Continue",
    BUTTON_ENABLE: "Enable",
    BUTTON_DISABLE: "Disable",

    BUTTON_MORE: "Next",
    BUTTON_REFRESH: "Refresh",
    BUTTON_HIDE: "Hide",
    BUTTON_CUSTOM: "Custom",
    BUTTON_LOADING: "...",

    PERCENT_0_1: "0.1%",
    PERCENT_0_5: "0.5%",
    PERCENT_1: "1%",
    PERCENT_25: "25%",
    PERCENT_50: "50%",
    PERCENT_100: "100%",

    AMOUNT_0_002_ETH: "0.002 ETH",
    AMOUNT_0_005_ETH: "0.005 ETH",
    AMOUNT_0_01_ETH: "0.01 ETH",
    AMOUNT_500_FUEL: "500 FUEL",
    AMOUNT_1000_FUEL: "1000 FUEL",
    AMOUNT_2000_FUEL: "2000 FUEL",

    ABOUT_MESSAGE_TEXT: "📚 Here are some helpful links:",
    ABOUT_BUTTON_DOCS: "📖 Docs & Guides",
    ABOUT_BUTTON_COMMUNITY: "💬 Support & Community",
    ABOUT_BUTTON_REPORT: "✍️ Report a Bug // Request a Feature",

    WITHDRAW_SELECT_ASSET_TEXT: "Select the asset you want to withdraw:",
    WITHDRAW_SELECT_ASSET_ERROR: "Invalid Asset Selected.",
    WITHDRAW_INPUT_TEXT: `
Balance: *%s %s*
Enter your Fuel wallet address to withdraw:`,
    WITHDRAW_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to withdraw.",
    WITHDRAW_SUCCESS_TEXT: "Funds have been successfully withdrawn.",
    WITHDRAW_AMOUNT_TEXT: "Specify how much to withdraw or enter 100%.",
    WITHDRAW_PERCENTAGE_ERROR: "Invalid percentage. Please enter a value between 1 and 100.",
    WITHDRAW_AMOUNT_ERROR: "Insufficient funds for withdrawal",
    WITHDRAW_INPUT_AMOUNT_ERROR: "Invalid input",

    SET_ALERTS_START_TEXT: "Current alerts: *%s*. Choose to toggle notifications or cancel.",
    SET_ALERTS_ENABLED: "Alerts enabled",
    SET_ALERTS_DISABLED: "Alerts disabled",

    SET_SLIPPAGE_START_TEXT: "Current value: *%s%*. Choose a slippage percentage or enter your own.",
    SET_SLIPPAGE_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 0 and 75.",
    SET_SLIPPAGE_SUCCESS: "Slippage successfully set to %s%.",

    SWAP_START_TEXT: `
*Swap %s -> %s*

Available: *%s* %s (%s %s)`,
    SWAP_INSUFFICIENT_FUNDS_TEXT: "Insufficient funds to swap.",
    SWAP_PERCENTAGE_ERROR: "Invalid value. Please enter a number between 1 and 100.",
    SWAP_CONFIRMATION_TEXT: "*%s %s* -> *%s %s*",
    SWAP_SUCCESS: "Transaction completed successfully!",
    SWAP_TOKEN_NOT_AVAILABLE: "Token: *%s*\nThis asset cannot be traded via FUEL",

    BUY_ENTER_ASSET: "Please enter the contract address of the token you want to buy:",
    BUY_ENTER_ASSET_ERROR: "Invalid contract address. Please try again.",
    BUY_START_TEXT: `
Token: *%s*
Available: *%s %s*

Enter the amount to spend or choose from the options below:`,
    BUY_AMOUNT_ERROR: "Invalid amount. Please enter a valid amount of FUEL less than your balance.",
    BUY_CONFIRMATION_TEXT: "*%s FUEL* -> *%s %s*.\nDo you want to proceed?",
    BUY_SUCCESS: "Transaction completed successfully!",
    BUY_INSUFFICIENT_FUNDS_TEXT: "You have insufficient FUEL to make a purchase.",
    BUY_FUEL_CONTRACT_ENTERED_ERROR: "You entered a *%s* contract.\nPlease provide a different asset contract.",

    SELL_NO_ASSETS_TEXT: "You don't have any assets available for sale.",
    SELL_START_TEXT_ASSET: "*Available Assets for Sale*\n\n%s\n\nSelect the asset you want to sell:",
    SELL_ASSET_BALANCE_TEXT: "Select the asset you want to sell:",
    SELL_SELECT_ASSET_ERROR: "Invalid Asset Selected.",
    SELL_SOMETHING_WRONG_TEXT: "Something went wrong.",
    SELL_ENTER_PERCENTAGE: "Selected asset: *%s*\n\nEnter the percentage of your %s to sell or select below:",
    SELL_CONFIRMATION_TEXT: "*%s %s* -> *%s %s*.\n\nDo you want to proceed?",
    SELL_PERCENTAGE_ERROR: "Invalid percentage. Please enter a value between 1 and 100.",
    SELL_SUCCESS: "Successfully sold!",

    POSITIONS_MORE_TEXT: "More %s positions",
    POSITIONS_NO_MORE_TEXT: "More %s positions",
    POSITIONS_NO_POSITIONS_TEXT: "You currently have no positions. Start by making a trade!",
    POSITIONS_NO_MORE_POSITIONS_TEXT: "You have no more positions.",

    WARNING_LOW_ETH_BALANCE: "_Maintain at least %s %s for proper fee handling_",
    WARNING_LOW_BALANCE_AFTER_BUY: "*WARNING!* _Your balance will drop below %s %s, risking future selling fees._",

    ENABLED: "Enabled",
    DISABLED: "Disabled",
} as const;

export function formatMessage(template: string, ...args: any[]): string {
    return template.replace(/%s/g, () => args.shift());
}