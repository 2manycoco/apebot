import {Context} from "telegraf";
import {ActionKeys, Actions, CommandKeys, Commands} from "./actions";
import {DexClient} from "../dex/dex_client";
import {WalletUnlocked} from "fuels";

export class UserSession {
    private ctx: Context;
    private userId: number;
    private wallet: WalletUnlocked;
    private dexClient: DexClient;

    constructor(ctx: Context, userId: number, wallet: WalletUnlocked, dexClient: DexClient) {
        this.userId = userId;
        this.ctx = ctx;
        this.wallet = wallet;
        this.dexClient = dexClient;
        this.start()
    }

    start() {

    }

    async handleCommand(command: CommandKeys) {
        switch (command) {
            case Commands.START:
                await this.onCommandStart()
                break;
            case Commands.ABOUT:
                await this.onCommandHelp();
                break;
            default:
                await this.ctx.reply("Unknown action. Please choose a valid option.");
        }
    }

    async onCommandStart(){
        await this.showBalances()
    }

    async onCommandHelp(){

    }

    // Handle actions for this session
    async handleAction(action: ActionKeys): Promise<void> {
        switch (action) {
            case Actions.VIEW_BALANCE:
                await this.viewBalance();
                break;
            case Actions.SWAP_ASSET:
                await this.swapAsset();
                break;
            case Actions.VIEW_WALLET_ADDRESS:
                await this.viewAddress();
                break;
            case Actions.VIEW_POSITIONS:
                await this.viewPositions();
                break;
            case Actions.WITHDRAW_FUNDS:
                await this.withdrawFunds();
                break;
            default:
                await this.ctx.reply("Unknown action. Please choose a valid option.");
        }
    }

    async handleMessage(message: string | number): Promise<void> {

    }

    // Private methods for handling specific actions
    private async viewBalance(): Promise<void> {
        // Mocked balance data
        const balances = "10 ETH, 500 USDC";
        await this.ctx.reply(`Your balance is: ${balances}`);
    }

    private async swapAsset(): Promise<void> {
        // Logic to initiate asset swap
        await this.ctx.reply("Please provide details of the swap.");
    }

    private async viewAddress(): Promise<void> {
        /*if (this.walletAddress) {
            await this.ctx.reply(`Your wallet address is: ${this.walletAddress}`);
        } else {
            await this.ctx.reply("Wallet address not found. Please try again later.");
        }*/
    }

    private async viewPositions(): Promise<void> {
        // Mock PNL data
        const pnl = "ETH: +5%, USDC: -2%";
        await this.ctx.reply(`Your current positions:\n${pnl}`);
    }

    private async withdrawFunds(): Promise<void> {
        // Logic for withdrawing funds
        await this.ctx.reply("Please provide the withdrawal details.");
    }


    //Для загруза Павла
    private async showBalances(): Promise<void> {
        // Logic to initiate asset swap
        await this.ctx.reply("Выводим балика и PNL");
    }

    private async showPosition(): Promise<void> {
        // Logic to initiate asset swap
        await this.ctx.reply("Выводим Текст позиции");
    }
}