import { IExtractorStrategy } from '../../domain/interfaces/IExtractorStrategy';
import { IAccessLogRepository } from '../../domain/interfaces/IAccessLogRepository';

export class ObtenerCodigoUseCase {
    private extractor: IExtractorStrategy;
    private logRepository: IAccessLogRepository;

    constructor(extractor: IExtractorStrategy, logRepository: IAccessLogRepository) {
        this.extractor = extractor;
        this.logRepository = logRepository;
    }

    async ejecutar(logId: string): Promise<string | null> {
        const TIEMPO_MAXIMO_MS = 120000;
        const INTERVALO_MS = 10000;
        const tiempoInicio = Date.now();

        return new Promise((resolve) => {
            const intervalo = setInterval(async () => {
                const tiempoTranscurrido = Date.now() - tiempoInicio;

                if (tiempoTranscurrido >= TIEMPO_MAXIMO_MS) {
                    clearInterval(intervalo);
                    await this.logRepository.actualizarLog(logId, 'TIMEOUT');
                    resolve(null);
                    return;
                }

                try {
                    const resultado = await this.extractor.extractOTP();

                    if (resultado) {
                        // 🛡️ ANTICOLISIÓN: Verificamos si este correo ya se le dio a otro usuario
                        const correoUsado = await this.logRepository.fueCorreoUsado(resultado.emailUid);
                        
                        if (!correoUsado) {
                            clearInterval(intervalo);
                            // Marcamos como SUCCESS y guardamos la evidencia
                            await this.logRepository.actualizarLog(logId, 'SUCCESS', resultado.codigo, resultado.emailUid);
                            resolve(resultado.codigo);
                            return;
                        } else {
                            console.log(`⚠️ Correo [UID: ${resultado.emailUid}] ya fue entregado. Ignorando...`);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error asíncrono en extracción:', error);
                    clearInterval(intervalo);
                    await this.logRepository.actualizarLog(logId, 'ERROR');
                    resolve(null);
                }
            }, INTERVALO_MS);
        });
    }
}