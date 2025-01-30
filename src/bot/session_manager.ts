import {Provider, WalletUnlocked} from "fuels";
import {UserSession} from "./user_session";
import {getUserRepository, UserRepository} from "../database/user_repository";
import {DexClient} from "../dex/dex_client";
import dotenv from "dotenv";
import {Context} from "telegraf";
import {createProvider} from "../fuel/functions";
import {trackUserAnalytics} from "./user_analytics";
import {Mutex} from "../utils/mutex";
import {EncryptionManager} from "../utils/encryption_manager";
import path from "node:path";
import {AnalyticsEvents} from "../analytics/analytics_events";

dotenv.config();
dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});


// Type definition for sessions
type SessionMap = Map<number, { session: UserSession; lastActivity: Date }>;

export class SessionManager {
    private static instance: SessionManager;
    private readonly provider: Provider;
    private readonly userRepository: UserRepository

    private sessions: SessionMap = new Map();
    private mutex = new Mutex();

    private readonly inactivityThreshold = 10 * 60 * 1000;

    private constructor(provider: Provider) {
        this.provider = provider
        this.startCleanupTask();
        this.userRepository = getUserRepository()
    }

    public static async getInstance(): Promise<SessionManager> {
        if (!SessionManager.instance) {
            const provider = await createProvider();
            SessionManager.instance = new SessionManager(provider);
        }
        return SessionManager.instance;
    }

    public async getSession(ctx: Context, userId: number): Promise<UserSession> {
        const existingSession = this.sessions.get(userId);
        if (existingSession) {
            existingSession.lastActivity = new Date();
            return existingSession.session;
        }

        let user = await this.userRepository.getUserById(userId);
        let wallet: WalletUnlocked;

        if (user) {
            try {
                wallet = new WalletUnlocked(EncryptionManager.decrypt(user.walletPK), this.provider);
            } catch (error) {
                throw new Error(`Failed to initialize wallet for user ${userId}: ${error.message}`);
            }
        } else {
            await this.mutex.acquire();
            try {
                user = await this.userRepository.getUserById(userId);
                if (!user) {
                    try {
                        wallet = this.generateWallet()
                        const walletAddress = wallet.address.toString();
                        const walletPK = EncryptionManager.encrypt(wallet.privateKey);
                        wallet.provider = this.provider;
                        user = {
                            telegramId: userId,
                            walletPK: walletPK,
                            walletAddress: walletAddress,
                            acceptedTerms: false,
                            slippage: 0.5,
                        };
                        await this.userRepository.saveUser(user);
                        trackUserAnalytics(ctx, "user_created");
                    } catch (error) {
                        throw new Error(`Failed to create a wallet for user ${userId}: ${error.message}`);
                    }
                } else {
                    wallet = new WalletUnlocked(EncryptionManager.decrypt(user.walletPK), this.provider);
                }
            } finally {
                this.mutex.release();
            }
        }

        const dexClient = new DexClient(this.provider, wallet);

        const newSession = new UserSession(ctx, userId, wallet, dexClient);
        this.sessions.set(userId, {session: newSession, lastActivity: new Date()});
        trackUserAnalytics(ctx, AnalyticsEvents.UserSessionStarted, {
            wallet_address: wallet.address.toString()
        })

        return newSession;
    }

    // Periodically clean up inactive sessions
    private startCleanupTask(): void {
        setInterval(() => {
            const now = new Date();
            for (const [userId, {lastActivity}] of this.sessions.entries()) {
                const inactivityDuration = now.getTime() - lastActivity.getTime();
                if (inactivityDuration > this.inactivityThreshold) {
                    this.sessions.delete(userId);
                }
            }
        }, 3 * 60 * 1000); // Run every 3 mins
    }

    private generateWallet() : WalletUnlocked{
        if(process.env.IS_DEVELOP == "true"){
            return new WalletUnlocked(process.env.TEST_WALLET_PK, this.provider);
        } else {
            return WalletUnlocked.generate();
        }
    }
}
