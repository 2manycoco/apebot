import {Context, Markup} from "telegraf";
import {Actions} from "./actions";
import {Strings} from "./resources/strings";

export async function replyMenu(ctx: Context, walletAddress: string, amount: number, symbol: string) {
    const message = `
*Wallet:* \`${walletAddress}\`

*Balance:* \`${amount} ${symbol}\`
`;

    await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(
            [
                [
                    Markup.button.callback(Strings.MENU_BUTTON_POSITIONS, Actions.MAIN_VIEW_POSITIONS),
                    Markup.button.callback(Strings.MENU_BUTTON_BALANCE, Actions.MAIN_BALANCE),
                ],
                [
                    Markup.button.callback(Strings.MENU_BUTTON_BUY, Actions.MAIN_BUY),
                    Markup.button.callback(Strings.MENU_BUTTON_WITHDRAW, Actions.MAIN_WITHDRAW_FUNDS),
                ],
                [
                    Markup.button.callback(Strings.MENU_BUTTON_WALLET_PK, Actions.MAIN_WALLET_PK)
                ]
            ]
        ),
    });
}

export async function replyBalance(ctx: Context, balances: Array<[string, string, string]>, sumAmount: number, symbol: string) {
    const maxSymbolLength = balances.reduce((max, [, symbol]) => Math.max(max, symbol.length), 0);
    const balancesMessage = balances
        .map(([, symbol, amount]) => `*${symbol.padEnd(maxSymbolLength)}:* \`${amount}\``)
        .join("\n");

    let amountFixed : string
    if (sumAmount != 0) {
        amountFixed = sumAmount.toFixed(5)
    } else {
        amountFixed = sumAmount.toFixed(2)
    }
    const message = `
${balancesMessage}    
    
*Total:* \`${amountFixed}\` ${symbol}
`;

    await ctx.reply(message, {parse_mode: "Markdown"});
}

export async function replyWalletPK(ctx: Context, walletPK: string) {
    const message = `
*Wallet PK:* \`${walletPK}\`
`;

    await ctx.reply(message, {parse_mode: "Markdown"});
}

/* PNL
 const pnlIcon = pnl >= 0 ? "🟢" : "🔴";
*PNL:* **${pnlIcon} ${pnl > 0 ? "+" : ""}${pnl}%***

//sumAmountEth.toFixed(6)
 */
