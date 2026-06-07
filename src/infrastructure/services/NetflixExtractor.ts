import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { IExtractorStrategy } from '../../domain/interfaces/IExtractorStrategy';

export class NetflixExtractor implements IExtractorStrategy {
    public providerName = 'Netflix';

    async extractOTP(): Promise<string | null> {
        const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: {
                user: process.env.IMAP_USER as string,
                pass: process.env.IMAP_PASS as string
            },
            logger: false
        });

        try {
            await client.connect();
            console.log(`✅ [${this.providerName}] Conectado a la bandeja de entrada.`);

            let lock = await client.getMailboxLock('INBOX');
            
            try {
                const messages = await client.search({
                    from: 'info@account.netflix.com',
                    seen: false 
                });

                // 🛡️ TYPE GUARD 1: Validamos que messages no sea 'false' y que tenga elementos
                if (!messages || messages.length === 0) {
                    return null;    
                }

                const ultimoUid = messages[messages.length - 1];
                
                // Le decimos a TypeScript que estamos seguros de que es un número
                const mensajeRaw = await client.fetchOne(ultimoUid as number, { source: true });
                
                // 🛡️ TYPE GUARD 2: Validamos que mensajeRaw no sea 'false' y contenga 'source'
                if (!mensajeRaw || !mensajeRaw.source) {
                    return null;
                }

                const parsed = await simpleParser(mensajeRaw.source);
                
                const textoCorreo = parsed.text || parsed.textAsHtml || '';
                const match = textoCorreo.match(/\b\d{4,6}\b/);

                if (match) {
                    return match[0];
                }
                
                return null;
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`❌ [${this.providerName}] Error en extracción:`, error);
            return null;
        } finally {
            await client.logout();
        }
    }
}