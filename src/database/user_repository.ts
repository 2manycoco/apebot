import {User} from "./entities";
import {Repository} from "typeorm";
import {AppDataSource} from "./database";

export interface UserRepository {
    getUserById(id: number): Promise<User | undefined>;

    saveUser(user: User): Promise<void>;

    deleteAllUsers(): Promise<void>;

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

    async deleteAllUsers(): Promise<void> {
        await this.userRepository.clear();
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


export function getUserRepository(): UserRepository {
    return UserStorage.getInstance()
}