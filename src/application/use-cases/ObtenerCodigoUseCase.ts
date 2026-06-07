import { IExtractorStrategy } from '../../domain/interfaces/IExtractorStrategy';

export class ObtenerCodigoUseCase {
    private extractor: IExtractorStrategy;

    // Inyectamos la estrategia (ej. NetflixExtractor)
    constructor(extractor: IExtractorStrategy) {
        this.extractor = extractor;
    }

    /**
     * Ejecuta la búsqueda del código con un timeout de 2 minutos.
     * Busca en la bandeja cada 10 segundos.
     */
    async ejecutar(): Promise<string | null> {
        const TIEMPO_MAXIMO_MS = 120000; // 2 minutos
        const INTERVALO_MS = 10000;      // 10 segundos
        const tiempoInicio = Date.now();

        console.log(`⏳ Iniciando búsqueda de código para ${this.extractor.providerName}...`);

        return new Promise((resolve) => {
            const intervalo = setInterval(async () => {
                const tiempoTranscurrido = Date.now() - tiempoInicio;

                // 1. Condición de salida por Timeout
                if (tiempoTranscurrido >= TIEMPO_MAXIMO_MS) {
                    clearInterval(intervalo);
                    console.log(`⏰ Tiempo de espera agotado para ${this.extractor.providerName}.`);
                    resolve(null);
                    return;
                }

                // 2. Intentar extraer el código
                const codigoEncontrado = await this.extractor.extractOTP();

                if (codigoEncontrado) {
                    clearInterval(intervalo);
                    resolve(codigoEncontrado);
                }
                
                // Si no lo encuentra, el ciclo se repite en los próximos 10 segundos
            }, INTERVALO_MS);
        });
    }
}