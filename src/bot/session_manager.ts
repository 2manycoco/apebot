import {Provider, WalletUnlocked} from "fuels";
import {UserSession} from "./user_session";
import {getUserRepository, UserRepository, UserStorage} from "../database/user_data_storage";
import {DexClient} from "../dex/dex_client";
import dotenv from "dotenv";
import {Context} from "telegraf";
import {createProvider} from "../fuel/functions";

dotenv.config();

// Type definition for sessions
type SessionMap = Map<number, { session: UserSession; lastActivity: Date }>;

export class SessionManager {
    private static instance: SessionManager;
    private readonly provider: Provider;
    private readonly userRepository: UserRepository

    private sessions: SessionMap = new Map();

    private readonly inactivityThreshold = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

    private constructor(provider: Provider) {
        this.provider = provider
        this.startCleanupTask();
        this.userRepository = getUserRepository()
    }

    public static async getInstance(): Promise<SessionManager> {
        if (!SessionManager.instance) {
            try {
                const provider = await createProvider();
                SessionManager.instance = new SessionManager(provider);
            } catch (error) {
                throw new Error("SessionManager initialization failed");
            }
        }
        return SessionManager.instance;
    }

    // Create or retrieve an existing session for a user
    public async getSession(ctx: Context, userId: number): Promise<UserSession> {
        const existingSession = this.sessions.get(userId);
        if (existingSession) {
            existingSession.lastActivity = new Date(); // Update last activity
            return existingSession.session;
        }

        // Fetch user data from UserStorage
        let user = await this.userRepository.getUserById(userId);
        let wallet: WalletUnlocked;

        // If user exists, initialize WalletUnlocked from stored data
        if (user) {
            try {
                wallet = new WalletUnlocked(user.walletPK, this.provider);
            } catch (error) {
                throw new Error(`Failed to initialize wallet for user ${userId}: ${error.message}`);
            }
        } else {
            // If user doesn't exist, create a new wallet and save the user
            try {
                wallet = WalletUnlocked.generate(); // Create a new wallet
                const walletAddress = wallet.address.toString();
                const walletPK = wallet.privateKey;
                wallet.provider = this.provider

                user = {
                    telegramId: userId,
                    walletPK,
                    walletAddress,
                };
                await this.userRepository.saveUser(user);
            } catch (error) {
                throw new Error(`Failed to create a wallet for user ${userId}: ${error.message}`);
            }
        }

        // Create DexClient for the user
        const dexClient = new DexClient(this.provider, wallet);

        // Create a new session
        const newSession = new UserSession(ctx, userId, wallet, dexClient);
        this.sessions.set(userId, {session: newSession, lastActivity: new Date()});
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
        }, 60 * 60 * 1000); // Run every 1 hour
    }
}
