import { IExtractorStrategy } from "../../domain/interfaces/IExtractorStrategy";
import { IAccessLogRepository } from "../../domain/interfaces/IAccessLogRepository";

export class GetAuthCodeUseCase {
  constructor(
    private extractor: IExtractorStrategy,
    private logRepository: IAccessLogRepository,
  ) {}

  async execute(logId: string): Promise<string | null> {
    try {
      // El extractor (Netflix) se tomará hasta 115 segundos buscando. Prime lo hará al instante.
      const result = await this.extractor.extractOTP();

      if (result) {
        const mailUsed = await this.logRepository.wasEmailUsed(result.emailUid);
        if (!mailUsed) {
          await this.logRepository.updateLog(
            logId,
            "SUCCESS",
            result.code,
            result.emailUid,
          );
          return result.code;
        } else {
          console.log(
            `⚠️ Correo [UID: ${result.emailUid}] ya fue entregado. Ignorando...`,
          );
        }
      }

      // Si llega aquí, es porque Netflix agotó sus 115s y devolvió null
      await this.logRepository.updateLog(logId, "TIMEOUT");
      return null;
    } catch (error) {
      console.error("❌ Error asíncrono en extracción:", error);
      await this.logRepository.updateLog(logId, "ERROR");
      return null;
    }
  }
}
