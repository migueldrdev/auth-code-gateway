// src/application/use-cases/AutorizarUsuarioUseCase.ts
import { IUserRepository } from '../../domain/interfaces/IUserRepository';

interface AuthorizeInput {
    externalId: string | number;         // Antes telegramId
    externalUsername: string | undefined; // Antes telegramUsername
    serviceName: string;
}

interface AuthorizeOutput {
    isAuthorized: boolean;
    message: string;
    userId?: string;
}

export class AuthorizeUserUseCase {
    private userRepository: IUserRepository;

    constructor(userRepository: IUserRepository) {
        this.userRepository = userRepository;
    }

    async execute(input: AuthorizeInput): Promise<AuthorizeOutput> {
        const { externalId, externalUsername, serviceName } = input;

        // 1. Intentar buscar al usuario por su ID Externo
        let user = await this.userRepository.findByExternalId(externalId);

        // 2. Si no existe por ID, intentar buscar por Username
        if (!user && externalUsername) {
            user = await this.userRepository.findByExternalUsername(externalUsername);
            if (user) {
                console.log(`🔗 Vinculando ID Externo ${externalId} al usuario @${externalUsername}`);
                await this.userRepository.linkExternalId(user.id, externalId);
            }
        }

        if (!user) {
            return {
                isAuthorized: false,
                message: '❌ No estás registrado en el sistema. Solicita acceso al administrador.'
            };
        }

        const hasActiveSubscription = await this.userRepository.checkSubscription(user.id, serviceName);

        if (!hasActiveSubscription) {
            return {
                isAuthorized: false,
                message: `🚫 Tu suscripción para el servicio [${serviceName}] no está activa o expiró.`
            };
        }

        return {
            isAuthorized: true,
            message: '✅ Acceso concedido.',
            userId: user.id
        };
    }
}