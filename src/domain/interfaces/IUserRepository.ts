import { User } from '../entities/User';

export interface IUserRepository {
    findByTelegramId(telegramId: number): Promise<User | null>;
    findByTelegramUsername(username: string): Promise<User | null>;
    linkTelegramId(userId: string, telegramId: number): Promise<void>;
    checkSubscription(userId: string, serviceName: string): Promise<boolean>;
}