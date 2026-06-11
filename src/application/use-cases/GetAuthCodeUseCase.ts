import { IExtractorStrategy } from '../../domain/interfaces/IExtractorStrategy';
import { IAccessLogRepository } from '../../domain/interfaces/IAccessLogRepository';

export class GetAuthCodeUseCase {
    private extractor: IExtractorStrategy;
    private logRepository: IAccessLogRepository;

    constructor(extractor: IExtractorStrategy, logRepository: IAccessLogRepository) {
        this.extractor = extractor;
        this.logRepository = logRepository;
    }

    async execute(logId: string): Promise<string | null> {
        const TIEMPO_MAXIMO_MS = 120000;
        const INTERVALO_MS = 10000;
        const tiempoInicio = Date.now();

        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                const tiempoTranscurrido = Date.now() - tiempoInicio;

                if (tiempoTranscurrido >= TIEMPO_MAXIMO_MS) {
                    clearInterval(interval);
                    await this.logRepository.updateLog(logId, 'TIMEOUT');
                    resolve(null);
                    return;
                }

                try {
                    const result = await this.extractor.extractOTP();

                    if (result) {
                        // 🛡️ ANTICOLISIÓN: Verificamos si este correo ya se le dio a otro usuario
                        const mailUsed = await this.logRepository.wasEmailUsed(result.emailUid);
                        
                        if (!mailUsed) {
                            clearInterval(interval);
                            // Marcamos como SUCCESS y guardamos la evidencia
                            await this.logRepository.updateLog(logId, 'SUCCESS', result.code, result.emailUid);
                            resolve(result.code);
                            return;
                        } else {
                            console.log(`⚠️ Correo [UID: ${result.emailUid}] ya fue entregado. Ignorando...`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error asíncrono en extracción:', error);
                    clearInterval(interval);
                    await this.logRepository.updateLog(logId, 'ERROR');
                    resolve(null);
                }
            }, INTERVALO_MS);
        });
    }
}