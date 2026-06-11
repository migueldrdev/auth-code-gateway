import { IMessageSender } from '../../../domain/interfaces/IMessageSender';
import { AuthorizeUserUseCase } from '../../../application/use-cases/AuthorizeUserUseCase';
import { GetAuthCodeUseCase } from '../../../application/use-cases/GetAuthCodeUseCase';
import { IAccessLogRepository } from '../../../domain/interfaces/IAccessLogRepository';
import { ICacheService } from '../../../domain/interfaces/ICacheService';

export class ServiceController {
    constructor(
        private serviceId: string,
        private serviceDisplayName: string,
        private authorizeUserUseCase: AuthorizeUserUseCase,
        private getAuthCodeUseCase: GetAuthCodeUseCase,
        private logRepository: IAccessLogRepository,
        private cacheService: ICacheService // ✅ Abstracción limpia
    ) {}

    async handle(externalId: number, username: string, sender: IMessageSender) {
        
        const now = Date.now();
        const lastClickTime = this.cacheService.getLastClickTime(externalId);

        // 🛡️ DEFENSE 1: Rate Limiting
        if (now - lastClickTime < 3000) {
            await sender.showPopup('⏳ Por favor espera unos segundos antes de volver a presionar.');
            return;
        }
        this.cacheService.setLastClickTime(externalId, now);

        // 🛡️ DEFENSE 2: Concurrency Lock
        if (this.cacheService.hasActiveRequest(externalId)) {
            await sender.showPopup('⚠️ Ya tienes una búsqueda de código en curso.');
            return;
        }

        // Remove the loading icon from the button
        await sender.showPopup(); 

        try {
            // 1. Authorization
            const validation = await this.authorizeUserUseCase.execute({
                externalId: externalId,
                externalUsername: username,
                serviceName: this.serviceId
            });

            if (!validation.isAuthorized) {
                await sender.sendMessage(validation.message);
                return;
            }

            // 2. Business Limits
            const successToday = await this.logRepository.getSuccessCountToday(validation.userId as string, this.serviceId);
            if (successToday >= 3) {
                await sender.sendMessage(`🚫 Límite diario alcanzado de ${this.serviceDisplayName}. Vuelve a intentarlo mañana.`);
                return;
            }

            // 3. Execution
            const logId = await this.logRepository.createLog(validation.userId as string, this.serviceId);
            this.cacheService.addActiveRequest(externalId);
            
            await sender.sendMessage(`⏳ Validación exitosa. Obteniendo tu código de ${this.serviceDisplayName}...`);

            const authCode = await this.getAuthCodeUseCase.execute(logId);

            if (authCode) {
                await sender.sendMessage(`🎉 ¡Código encontrado!\n\nTu código es: *${authCode}*`);
                await sender.notifyAdmin(`✅ ÉXITO: Código entregado a @${username}`);
            } else {
                await sender.sendMessage('⏰ Tiempo agotado o hubo un error al obtener el código.');
            }
        } catch (error) {
            console.error(`❌ Error in ServiceController [${this.serviceId}]:`, error);
            await sender.sendMessage('❌ Ocurrió un error interno en el servidor.');
        } finally {
            this.cacheService.removeActiveRequest(externalId); // ✅ Eliminación limpia
        }
    }
}