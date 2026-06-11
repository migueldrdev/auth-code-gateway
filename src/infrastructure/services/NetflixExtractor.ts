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

    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");

      try {
        // 1. Búsqueda estricta: Solo correos no leídos del remitente oficial de OTPs
        const mensajes = await client.search({
          seen: false,
          from: "info@account.netflix.com",
        });

        if (!mensajes || mensajes.length === 0) return null;

        // Obtenemos el último UID del arreglo (ya sabemos que es seguro) 
        const ultimoUid = mensajes[mensajes.length - 1] as number;

        // Pedimos el contenido del correo
        const mensajeRaw = await client.fetchOne(ultimoUid, { source: true });

        // 🛡️ NUEVA DEFENSA: Verificamos que sí se haya descargado correctamente
        if (!mensajeRaw || !mensajeRaw.source) {
          return null;
        }

        const parsed = await simpleParser(mensajeRaw.source);
        const texto = parsed.text || "";

        // 2. Regex estricto: Busca exactamente 4 dígitos rodeados de espacios/bordes
        const regex = /\b\d{4}\b/;
        const match = texto.match(regex);

        if (match) {
          // 3. ¡MARCAR COMO LEÍDO!
          // Agregamos la bandera \Seen a este correo en Gmail
          await client.messageFlagsAdd(ultimoUid, ["\\Seen"], { uid: true });

          return {
            code: match[0],
            emailUid: ultimoUid,
          };
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error("Error en NetflixExtractor:", error);
    } finally {
      await client.logout();
    }

    return null;
  }
}
