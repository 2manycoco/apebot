import {Context, Markup} from "telegraf";
import {Actions, ActionValues, Commands, CommandValues} from "./actions";
import {DexClient} from "../dex/dex_client";
import {WalletUnlocked} from "fuels";
import {getUserRepository, UserRepository} from "../database/user_repository";
import {Logger} from "../utils/logger";
import AnalyticsService from "../analytics/analytics_service";
import {trackUserAnalytics} from "./user_analytics";
import {Flow} from "./flow/flow";
import {UserManager} from "./user_manager";
import {withProgress} from "./help_functions";
import {IntroduceFlow} from "./flow/introduce_flow";
import {TRADE_ASSET} from "../fuel/asset/contracts";
import {replyBalance, replyMenu, replyWalletPK} from "./session_message_builder";
import dotenv from "dotenv";
import path from "node:path";
import {FlowId, FlowValues} from "./flow/flow_ids";
import {WithdrawFlow} from "./flow/withdraw_flow";
import {SetSlippageFlow} from "./flow/set_slippage_flow";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

export class UserSession {
    private ctx: Context;
    private userId: number;
    private wallet: WalletUnlocked;
    private dexClient: DexClient;

    private userManager: UserManager
    private logger: Logger
    private analytics: AnalyticsService
    private userRepository: UserRepository

    private activeFlow: Flow | null = null;

    constructor(ctx: Context, userId: number, wallet: WalletUnlocked, dexClient: DexClient) {
        this.userId = userId;
        this.ctx = ctx;
        this.wallet = wallet;
        this.dexClient = dexClient;
        this.userManager = new UserManager(ctx, userId)
        this.userRepository = getUserRepository()
        this.logger = Logger.getInstance()
        this.analytics = AnalyticsService.getInstance()
    }

    async handleCommand(command: CommandValues) {
        await trackUserAnalytics(this.ctx, "user_command", {
            command_name: command
        })
        await this.handleUserTerms(async () => {
            switch (command) {
                case Commands.START:
                    await this.onCommandStart()
                    break;
                case Commands.ABOUT:
                    await this.onCommandHelp();
                    break;
                case Commands.DOCS:
                    await this.onCommandDocs();
                    break;
                default:
                    await this.ctx.reply("Unknown action. Please choose a valid option.");
            }
        });
    }

    private async onCommandStart() {
        await this.showMenu()
    }

    private async onCommandHelp() {

    }

    private async onCommandDocs() {
        await this.ctx.reply(
            "Откройте документацию, нажав на кнопку ниже:",
            {
                ...Markup.inlineKeyboard([
                    Markup.button.url("Открыть документацию", process.env.DOC_URL),
                ]),
            }
        );
    }

    /**
     * Handle actions from buttons during an active Flow.
     * @param action The action string received from the button callback.
     */
    async handleAction(action: ActionValues): Promise<void> {
        await trackUserAnalytics(this.ctx, "user_action", {
            action_name: action
        })
        const isIntercepted = await this.interceptOnActiveFLow(async () => {
            return this.activeFlow.handleAction(action)
        })
        if (isIntercepted) return

        if (await this.handleMenuAction(action)) {
            return
        }

        await this.onCommandStart()
    }

    private async handleMenuAction(action: ActionValues): Promise<boolean> {
        switch (action) {
            case Actions.MAIN_BALANCE:
                await this.showBalance();
                return true;
            case Actions.MAIN_WALLET_PK:
                await this.showWalletPK();
                return true;
             case Actions.MAIN_WITHDRAW_FUNDS:
                 await this.withdrawFunds();
                 return true;
            case Actions.MAIN_SLIPPAGE:
                await this.setSlippage();
                return true;
             /*case Actions.MAIN_VIEW_POSITIONS:
                 await this.viewPositions();
                  return true;*/
            default:
                return false;
        }
    }

    /**
     * Handle incoming messages during an active Flow.
     * @param message The message or input from the user.
     */
    async handleMessage(message: string): Promise<void> {
        await trackUserAnalytics(this.ctx, "user_message", {
            message: message
        })
        const isIntercepted = this.interceptOnActiveFLow(async () => {
            return this.activeFlow.handleMessage(message)
        })
        if (isIntercepted) return

        if (await this.handleMenuMessage(message)) {
            return
        }

        await this.onCommandStart()
    }

    private async handleMenuMessage(message: string): Promise<boolean> {
        return false;
    }

    /**
     * Start a new Flow, cleaning up the previous one if necessary.
     * @param flow The new Flow to start.
     */
    async startFlow(flow: Flow): Promise<void> {
        if (this.activeFlow) {
            await this.activeFlow.cleanup();
        }
        this.activeFlow = flow;
        await flow.start();
    }

    /**
     * Callback to handle the completion of a Flow.
     * @param flowId - The identifier of the completed Flow.
     */
    private async onFlowCompleted(flowId: FlowValues) {
        this.activeFlow = null;
        switch (flowId) {
           /* case FlowId.INTRO_FLOW:
                await this.showMenu()
                break;*/
        }
        await this.showMenu()
    }

    // ---------- Main simple action ----------

    private async showMenu(): Promise<void> {
        const walletAddress = this.wallet.address.toString()
        let amount: number
        await withProgress(this.ctx, async () => {
            const [responseAmount] = await this.dexClient.getBalance(TRADE_ASSET.bits);
            amount = responseAmount
        })

        await replyMenu(this.ctx, walletAddress, amount, TRADE_ASSET.symbol)
    }

    private async showBalance(): Promise<void> {
        let totalBalance = 0;
        let balances: Array<[string, string, string]>
        await withProgress(this.ctx, async () => {
            balances = await this.dexClient.getBalances();
            for (const [assetId, symbol, amount] of balances) {
                const balanceAmount = parseFloat(amount);
                if (symbol === TRADE_ASSET.symbol) {
                    totalBalance += balanceAmount;
                } else {
                    try {
                        const rate = await this.dexClient.getRate(assetId, TRADE_ASSET.bits);
                        const equivalent = balanceAmount * rate;
                        totalBalance += equivalent;
                    } catch (error) {
                        console.warn(`Failed to fetch rate for asset ${symbol}: ${error.message}`);
                    }
                }
            }
        })

        await replyBalance(this.ctx, balances, totalBalance, TRADE_ASSET.symbol)
    }

    private async showWalletPK(): Promise<void> {
        const walletPK = this.wallet.privateKey
        await replyWalletPK(this.ctx, walletPK)
    }

    private async withdrawFunds(): Promise<void> {
        await this.startFlow(new WithdrawFlow(this.ctx, this.userId, this.wallet, this.dexClient, (flowId:FlowValues) => {
            this.onFlowCompleted(flowId);
        }));
    }

    private async setSlippage(): Promise<void> {
        await this.startFlow(new SetSlippageFlow(this.ctx, this.userId, (flowId:FlowValues) => {
            this.onFlowCompleted(flowId);
        }));
    }

    // ---------- Utils functions ----------

    private async interceptOnActiveFLow(
        handleCall: () => Promise<boolean>
    ): Promise<boolean> {
        if (this.activeFlow) {
            return handleCall()
        } else {
            return false
        }
    }

    async handleUserTerms(
        afterCall: () => Promise<void>
    ): Promise<void> {
        const isAccept = await this.userManager.isAcceptTerms()
        if (!isAccept) {
            await this.startFlow(new IntroduceFlow(this.ctx, this.userId, (flowId:FlowValues) => {
                this.onFlowCompleted(flowId);
            }));
        } else {
            await afterCall()
        }
    }
}