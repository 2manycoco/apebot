import {User} from "./entities";
import {Repository} from "typeorm";
import {AppDataSource} from "./database";
import dotenv from "dotenv";
import {id} from "ethers";

dotenv.config();

export interface UserRepository {
    getUserById(id: number): Promise<User | undefined>;

    saveUser(user: User): Promise<void>;

    deleteUser(id: number): Promise<void>;

    getAllUsers(): Promise<User[]>;

    updateAcceptedTerms(userId: number, accepted: boolean): Promise<void>;
}

export class UserStorage implements UserRepository {
    private static instance: UserStorage;
    private userRepository: Repository<User>;

    private constructor() {
        this.userRepository = AppDataSource.getRepository(User);
    }

    public static getInstance(): UserStorage {
        if (!UserStorage.instance) {
            UserStorage.instance = new UserStorage();
        }
        return UserStorage.instance;
    }

    async getUserById(id: number): Promise<User | undefined> {
        return await this.userRepository.findOneBy({telegramId: id});
    }

    async saveUser(user: User): Promise<void> {
        await this.userRepository.save(user);
    }

    async deleteUser(id: number): Promise<void> {
        await this.userRepository.delete({telegramId: id});
    }

    async getAllUsers(): Promise<User[]> {
        return await this.userRepository.find();
    }

    async updateAcceptedTerms(userId: number, accepted: boolean): Promise<void> {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        user.acceptedTerms = accepted;
        await this.userRepository.save(user);
    }
}


export class UserMapStorage implements UserRepository {
    private static instance: UserMapStorage;
    private users: Map<number, User>;

    private constructor() {
        this.users = new Map<number, User>();
    }

    public static getInstance(): UserMapStorage {
        if (!UserMapStorage.instance) {
            UserMapStorage.instance = new UserMapStorage();
        }
        return UserMapStorage.instance;
    }

    async getUserById(id: number): Promise<User | undefined> {
        return this.users.get(id);
    }

    async saveUser(user: User): Promise<void> {
        this.users.set(user.telegramId, user);
    }

    async deleteUser(id: number): Promise<void> {
        this.users.delete(id);
    }

    async getAllUsers(): Promise<User[]> {
        return Array.from(this.users.values());
    }

    async updateAcceptedTerms(userId: number, accepted: boolean): Promise<void> {
        const user = await this.getUserById(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
        }
        user.acceptedTerms = accepted;
        await this.saveUser(user);
    }
}

export function getUserRepository(): UserRepository {
    if (process.env.USE_LOCAL_STORAGE=== "false") {
        return UserStorage.getInstance()
    } else {
        return UserMapStorage.getInstance()
    }
}