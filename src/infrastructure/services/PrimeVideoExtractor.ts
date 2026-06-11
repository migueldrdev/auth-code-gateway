import { generate } from 'otplib';
import { IExtractorStrategy } from '../../domain/interfaces/IExtractorStrategy';

export class PrimeVideoExtractor implements IExtractorStrategy {
    providerName = 'prime';

    async extractOTP(): Promise<{ code: string; emailUid: number } | null> {
        const secret = process.env.PRIME_TOTP_SECRET;

        if (!secret) {
            console.error('❌ PRIME_TOTP_SECRET no está definido en las variables de entorno.');
            return null;
        }

        try {
            // 🛡️ SOLUCIÓN: API moderna de otplib v13 (100% asíncrona y sin clases)
            const token = await generate({ secret });
            
            // Usamos Date.now() como un emailUid falso único para el log de Supabase
            const fakeUid = Date.now();

            return {
                code: token,
                emailUid: fakeUid
            };
        } catch (error) {
            console.error('❌ Error generando el TOTP de Prime Video:', error);
            return null;
        }
    }
}