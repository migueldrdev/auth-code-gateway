// src/domain/interfaces/IUserRepository.ts
import { User } from '../entities/User';

export interface IUserRepository {
    findByExternalId(externalId: string | number): Promise<User | null>;
    findByExternalUsername(username: string): Promise<User | null>;
    linkExternalId(userId: string, externalId: string | number): Promise<void>;
    checkSubscription(userId: string, serviceName: string): Promise<boolean>;
    obtenerIdentidadesPermitidas(): Promise<{ ids: (string|number)[], usernames: string[] }>;
}