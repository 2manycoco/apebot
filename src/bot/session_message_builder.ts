import {Context, Markup} from "telegraf";
import {Actions} from "./actions";
import {formatMessage, Strings} from "./resources/strings";
import {Message} from "@telegraf/types";
import {CONTRACTS} from "../fuel/asset/contracts";

export async function replyMenu(ctx: Context, walletAddress: string, amountsAndSymbols: Array<[number, string]>, prices: string, warning: string = "") {
    const warningMessage = warning ? `\n${warning}` : "";
    const formattedAmounts = amountsAndSymbols
        .map(([amount, symbol]) => `${symbol}: ${amount}`)
        .join("\n");
    const message = formatMessage(Strings.MENU_TEXT + warningMessage, walletAddress, prices, formattedAmounts);
    await ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(
            [
                [
                    Markup.button.callback(Strings.MENU_BUTTON_BUY, Actions.MAIN_BUY),
                    Markup.button.callback(Strings.MENU_BUTTON_POSITIONS, Actions.MAIN_VIEW_POSITIONS),
                ],
                [
                    Markup.button.callback(Strings.MENU_BUTTON_SELL, Actions.MAIN_SELL),
                    Markup.button.callback(Strings.MENU_BUTTON_WALLET, Actions.MAIN_WALLET),
                ],
                [
                    Markup.button.callback(Strings.MENU_BUTTON_SLIPPAGE, Actions.MAIN_SLIPPAGE),
                    Markup.button.callback(Strings.MENU_BUTTON_WALLET_PK, Actions.MAIN_WALLET_PK)
                ],
                [
                    Markup.button.callback(Strings.MENU_BUTTON_WITHDRAW, Actions.MAIN_WITHDRAW_FUNDS)
                ]
            ]
        ),
    });
}

export async function replyBalance(
    ctx: Context,
    balances: Array<[string, string, string, boolean]>,
    sumAmount: number,
    symbol: string
) {
    const maxSymbolLength = balances.reduce((max, [, symbol]) => Math.max(max, symbol.length), 0);

    balances.sort(([ , symbolA ], [ , symbolB ]) => {
        if (symbolA === CONTRACTS.ASSET_FUEL.symbol) return -1;
        if (symbolB === CONTRACTS.ASSET_FUEL.symbol) return 1;
        if (symbolA === CONTRACTS.ASSET_ETH.symbol) return -1;
        if (symbolB === CONTRACTS.ASSET_ETH.symbol) return 1;

        return symbolA.localeCompare(symbolB);
    });

    const balanceMessage = balances
        .map(([, symbol, amount]) => `*${symbol.padEnd(maxSymbolLength)}:* \`${amount}\``)
        .join("\n");

    const amountFixed = sumAmount !== 0 ? sumAmount.toFixed(5) : sumAmount.toFixed(2);

    const message = formatMessage(Strings.BALANCE_TEXT, balanceMessage, amountFixed, symbol);

    await ctx.reply(message, { parse_mode: "Markdown" });
}

export async function replyWalletPK(ctx: Context, walletPK: string) {
    const message = formatMessage(Strings.WALLET_PK_TEXT, walletPK);
    return await ctx.reply(message, {parse_mode: "MarkdownV2"});
}

export async function replyConfirmMessage(ctx: Context, confirmationMessage: string): Promise<Message> {
    return await ctx.reply(confirmationMessage, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback(Strings.BUTTON_CANCEL, Actions.CANCEL),
                Markup.button.callback(Strings.BUTTON_CONFIRM, Actions.CONFIRM),
            ],
        ]),
    });
}

/* PNL
 const pnlIcon = pnl >= 0 ? "🟢" : "🔴";
*PNL:* **${pnlIcon} ${pnl > 0 ? "+" : ""}${pnl}%***

//sumAmountEth.toFixed(6)
 */
