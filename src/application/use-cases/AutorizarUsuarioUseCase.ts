import { log } from 'node:console';
import { IUserRepository } from '../../domain/interfaces/IUserRepository';

interface AutorizarInput {
    telegramId: number;
    telegramUsername: string | undefined;
    serviceName: string;
}

interface AutorizarOutput {
    isAuthorized: boolean;
    message: string;
    userId?: string;
}

export class AutorizarUsuarioUseCase {
    private userRepository: IUserRepository;

    constructor(userRepository: IUserRepository) {
        this.userRepository = userRepository;
    }

    async ejecutar(input: AutorizarInput): Promise<AutorizarOutput> {
 
        const { telegramId, telegramUsername, serviceName } = input;

        // 1. Intentar buscar al usuario por su Telegram ID (El camino rápido e inmutable)
        let user = await this.userRepository.findByTelegramId(telegramId);

        // 2. Si no existe por ID, intentar buscar por Username (Registro manual previo en BD)
        if (!user && telegramUsername) {
            user = await this.userRepository.findByTelegramUsername(telegramUsername);
            console.log(`Resultado de búsqueda por username:`, user);
            if (user) {
                // Si el usuario existía por username pero no tenía ID, lo enlazamos en este instante
                console.log(`🔗 Vinculando Telegram ID ${telegramId} al usuario @${telegramUsername}`);
                await this.userRepository.linkTelegramId(user.id, telegramId);
            }
        }

        // 3. Si no se encontró de ninguna forma, el acceso es denegado inmediatamente
        if (!user) {
            return {
                isAuthorized: false,
                message: '❌ No estás registrado en el sistema. Solicita acceso al administrador proporcionando tu nombre de usuario.'
            };
        }

        // 4. El usuario existe, ahora verificamos si tiene una suscripción activa para el servicio solicitado
        const hasActiveSubscription = await this.userRepository.checkSubscription(user.id, serviceName);

        if (!hasActiveSubscription) {
            return {
                isAuthorized: false,
                message: `🚫 Tu suscripción para el servicio [${serviceName}] no está activa o ya ha expirado.`
            };
        }

        // 5. Todo en orden: Usuario identificado y con pago/suscripción al día
        return {
            isAuthorized: true,
            message: '✅ Acceso concedido.',
            userId: user.id
        };
    }
}