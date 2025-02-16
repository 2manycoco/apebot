import {Context, Markup} from "telegraf";
import {Actions, ActionValues, Commands, CommandValues, TemplateActions, TemplateActionValues} from "./actions";
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
import {CONTRACTS, TRADE_ASSET} from "../fuel/asset/contracts";
import {replyMenu, replyWalletPK} from "./session_message_builder";
import dotenv from "dotenv";
import path from "node:path";
import {FlowId, FlowValues} from "./flow/flow_ids";
import {WithdrawFlow} from "./flow/withdraw_flow";
import {SetSlippageFlow} from "./flow/set_slippage_flow";
import {SwapFlow} from "./flow/swap_flow";
import {isValidFuelAddress} from "../fuel/functions";
import {BuyFlow} from "./flow/buy_flow";
import {SellFlow} from "./flow/sell_flow";
import {BalanceFlow} from "./flow/balance_flow";
import {generatePriceMessage} from "../fuel/price_fetcher";
import {PositionsFlow} from "./flow/positions_flow";
import {formatMessage, Strings} from "./resources/strings";
import {AnalyticsEvents} from "../analytics/analytics_events";
import {LOW_BALANCE_ETH_VALUE} from "../fuel/constants";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

const deletePKMessageTimeout = 30000

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
        trackUserAnalytics(this.ctx, AnalyticsEvents.UserCommand, {
            command_name: command
        })
        await this.handleUserTerms(async () => {
            await this.cleanActiveFlow()
            switch (command) {
                case Commands.START:
                    await this.onCommandStart()
                    break;
                case Commands.POSITIONS:
                    await this.onCommandPositions();
                    break;
                case Commands.BUY:
                    await this.startBuy(null);
                    break;
                case Commands.SELL:
                    await this.startSell(null);
                    break;
                case Commands.INFO:
                    await this.onCommandInfo();
                    break;
                default:
                    this.analytics.trackError(AnalyticsEvents.ErrorUnknownCommand)
                    await this.ctx.reply("Unknown action. Please choose a valid option.");
            }
        });
    }

    private async onCommandStart() {
        await this.showMenu()
    }

    private async onCommandPositions() {
        await this.showPositions()
    }

    private async onCommandInfo() {
        await this.ctx.reply(
            Strings.ABOUT_MESSAGE_TEXT,
            Markup.inlineKeyboard([
                [Markup.button.url(Strings.ABOUT_BUTTON_DOCS, process.env.DOC_URL)],
                [Markup.button.url(Strings.ABOUT_BUTTON_COMMUNITY, process.env.TELEGRAM_URL_GENERAL)],
                [Markup.button.url(Strings.ABOUT_BUTTON_REPORT, process.env.TELEGRAM_URL_REPORT)],
            ])
        );
    }

    /**
     * Handle actions from buttons during an active Flow.
     * @param action The action string received from the button callback.
     */
    async handleAction(action: ActionValues): Promise<void> {
        trackUserAnalytics(this.ctx, AnalyticsEvents.UserAction, {
            action_name: action
        })

        const isIntercepted = await this.interceptOnActiveFLow(async () => {
            return this.activeFlow.handleAction(action)
        })
        if (isIntercepted) return

        if (await this.handleMenuAction(action)) {
            return
        }

        await this.handleUserTerms(async () => {
            return await this.onCommandStart()
        });
    }

    async handleTemplateAction(action: TemplateActionValues): Promise<void> {
        trackUserAnalytics(this.ctx, AnalyticsEvents.UserTemplateAction, {
            action_name: action
        })

        await this.interceptOnActiveFLow(async () => {
            return this.activeFlow.handleTemplateAction(action)
        })

        if (await this.handleMenuTemplateAction(action)) {
            return
        }
    }

    private async handleMenuTemplateAction(action: TemplateActionValues): Promise<boolean> {
        const {type, symbol, id, percentage} = action;

        if (type == "SELL") {
            await this.cleanActiveFlow()
            await this.startSell(symbol, percentage)
            return true;
        }
    }

    private async handleMenuAction(action: ActionValues): Promise<boolean> {
        switch (action) {
            case Actions.MAIN_WALLET:
                await this.showBalance();
                return true;
            case Actions.MAIN_VIEW_POSITIONS:
                await this.showPositions();
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
            case Actions.MAIN_BUY:
                await this.startBuy(null)
                return true;
            case Actions.MAIN_SELL:
                await this.startSell()
                return true;
            default:
                return false;
        }
    }

    /**
     * Handle incoming messages during an active Flow.
     * @param message The message or input from the user.
     */
    async handleMessage(message: string): Promise<void> {
        trackUserAnalytics(this.ctx, AnalyticsEvents.UserMessage, {
            message: message
        })
        const isIntercepted = await this.interceptOnActiveFLow(async () => {
            return this.activeFlow.handleMessage(message)
        })
        if (isIntercepted) return

        if (await this.handleMenuMessage(message)) {
            return
        }

        await this.handleUserTerms(async () => {
            return await this.onCommandStart()
        });

        trackUserAnalytics(this.ctx, AnalyticsEvents.UserMessageUnexpected, {
            message: message
        })
    }

    private async handleMenuMessage(message: string): Promise<boolean> {
        if (isValidFuelAddress(message)) {
            if (message === TRADE_ASSET.bits) {
                await this.showBalance();
                return true;
            } else {
                await this.startBuy(message)
                return true;
            }
        }
        return false;
    }

    /**
     * Start a new Flow, cleaning up the previous one if necessary.
     * @param flow The new Flow to start.
     */
    private async startFlow(flow: Flow): Promise<void> {
        if (this.activeFlow) {
            await this.activeFlow.cleanup();
        }
        this.activeFlow = flow;
        await flow.start();
    }

    private async cleanActiveFlow(): Promise<void> {
        if (this.activeFlow) {
            await this.activeFlow.cleanup();
            this.activeFlow = null
        }
    }

    /**
     * Callback to handle the completion of a Flow.
     * @param flowId - The identifier of the completed Flow.
     * @param successful - Is Flow successful finished
     */
    private async onFlowCompleted(flowId: FlowValues, successful: Boolean) {
        this.activeFlow = null;
        switch (flowId) {
            case FlowId.SWAP_FLOW:
            case FlowId.BUY_FLOW:
            case FlowId.SELL_FLOW:
                if(successful) {
                    await this.showBalance()
                }
                return true;
            case FlowId.BALANCE_FLOW:
            case FlowId.POSITIONS_FLOW:
                return true;

        }
        await this.showMenu()
    }

    // ---------- Main simple action ----------

    private async showMenu(): Promise<void> {
        await this.cleanActiveFlow()
        const walletAddress = this.wallet.address.toString()

        let amountTrade: number
        let amountEth: number
        let prices: string
        await withProgress(this.ctx, async () => {
            const [responseAmount] = await this.dexClient.getBalance(TRADE_ASSET.bits);
            amountTrade = responseAmount

            const [responseAmountEth] = await this.dexClient.getBalance(CONTRACTS.ASSET_ETH.bits);
            amountEth = responseAmountEth;

            prices = generatePriceMessage()
        })

        const balanceWarning =
            (amountEth > 0 && amountEth < LOW_BALANCE_ETH_VALUE)
                ? formatMessage(Strings.WARNING_LOW_ETH_BALANCE, LOW_BALANCE_ETH_VALUE, CONTRACTS.ASSET_ETH.symbol) : undefined

        await replyMenu(this.ctx, walletAddress,
            [[amountTrade, TRADE_ASSET.symbol], [amountEth, CONTRACTS.ASSET_ETH.symbol]],
            prices,
            balanceWarning
        );
    }

    private async showBalance(): Promise<void> {
        return await this.startFlow(new BalanceFlow(this.ctx, this.userId, this.dexClient, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async showWalletPK(): Promise<void> {
        await this.cleanActiveFlow()

        const walletPK = this.wallet.privateKey
        const message = await replyWalletPK(this.ctx, walletPK);

        setTimeout(async () => {
            try {
                await this.ctx.telegram.deleteMessage(this.ctx.chat.id, message.message_id);
            } catch (error) {
                console.error("Failed to delete wallet PK message:", error.message);
            }
        }, deletePKMessageTimeout);
    }

    private async withdrawFunds(): Promise<void> {
        await this.startFlow(new WithdrawFlow(this.ctx, this.userId, this.wallet, this.dexClient, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async setSlippage(): Promise<void> {
        await this.startFlow(new SetSlippageFlow(this.ctx, this.userId, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async startSwap(assertIn: string, assertOut: string, amountPercentage: number | null): Promise<void> {
        await this.startFlow(new SwapFlow(this.ctx, this.userId, this.dexClient, assertIn, assertOut, amountPercentage, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async showPositions(): Promise<void> {
        await this.startFlow(new PositionsFlow(this.ctx, this.userId, this.dexClient, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async startBuy(assetId: string | null): Promise<void> {
        await this.startFlow(new BuyFlow(this.ctx, this.userId, this.dexClient, assetId, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
        }));
    }

    private async startSell(symbol: string | null = null, percentage: number | null = null): Promise<void> {
        await this.startFlow(new SellFlow(this.ctx, this.userId, this.dexClient, symbol, percentage, (flowId: FlowValues, successful: Boolean) => {
            this.onFlowCompleted(flowId, successful);
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
            await this.startFlow(new IntroduceFlow(this.ctx, this.userId, (flowId: FlowValues, successful: Boolean) => {
                this.onFlowCompleted(flowId, successful);
            }));
        } else {
            await afterCall()
        }
    }
}