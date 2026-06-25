import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { IExtractorStrategy } from "../../domain/interfaces/IExtractorStrategy";

export class NetflixExtractor implements IExtractorStrategy {
  public providerName = "Netflix";

  async extractOTP(): Promise<{ code: string; emailUid: number } | null> {
    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: process.env.IMAP_USER as string,
        pass: process.env.IMAP_PASS as string,
      },
      logger: false,
    });

    // 🛡️ ESCUDO ANTI-CRASH: Atrapa errores de red de fondo para que Node.js no se apague
    client.on('error', (err) => {
        console.log('⚠️ IMAP Error de red ignorado de forma segura:', err.message);
    });
    
    client.on('close', () => {
        console.log('⚠️ Conexión IMAP cerrada por el servidor.');
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        const startTime = Date.now();
        const timeout = 115000; 

        while (Date.now() - startTime < timeout) {
          // 🛡️ Verificamos que el socket siga vivo antes de preguntar
          if (!client.usable) {
              console.log('⚠️ El socket de IMAP murió (ETIMEDOUT). Abortando este ciclo...');
              break; // Rompemos el bucle para que el UseCase vuelva a intentar con una nueva conexión
          }

          const mensajes = await client.search({
            seen: false,
            from: "info@account.netflix.com",
          });

          if (mensajes && mensajes.length > 0) {
            const ultimoUid = mensajes[mensajes.length - 1] as number;
            const mensajeRaw = await client.fetchOne(ultimoUid, { source: true });

            if (mensajeRaw && mensajeRaw.source) {
              const parsed = await simpleParser(mensajeRaw.source);
              const texto = parsed.text || "";
              const regex = /\b\d{4}\b/;
              const match = texto.match(regex);

              if (match) {
                await client.messageFlagsAdd(ultimoUid, ["\\Seen"], { uid: true });
                return { code: match[0], emailUid: ultimoUid };
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } finally {
        lock.release();
      }
    } catch (error: any) {
      console.error("❌ Error controlado en NetflixExtractor:", error.message);
    } finally {
      // 🛡️ Cierre seguro incluso si el socket ya colapsó
      try {
         if (client.usable) {
             await client.logout();
         } else {
             client.close();
         }
      } catch (e) {
         // Cierre silencioso
      }
    }

    return null;
  }
}