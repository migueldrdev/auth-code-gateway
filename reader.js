require('dotenv').config();
const { ImapFlow } = require('imapflow');
const simpleParser = require('mailparser').simpleParser;

// 1. Configuración de conexión IMAP (Gmail)
const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
        user: process.env.IMAP_USER,
        pass: process.env.IMAP_PASS // No tu password normal, sino la de Aplicación de Google
    },
    logger: false // Ponlo en true si quieres ver todo el tráfico de red en la consola
});

async function buscarCodigoNetflix() {
    try {
        await client.connect();
        console.log('✅ Conectado a Gmail con éxito.');

        // Seleccionar la bandeja de entrada
        let lock = await client.getMailboxLock('INBOX');
        
        try {
            // 2. Buscar correos NO LEÍDOS enviados por Netflix
            // Nota: Ajusta el correo de 'from' según la dirección exacta que usa Netflix
            const searchCriteria = {
                from: 'info@account.netflix.com',
                // seen: false 
            };

            // Buscar los UIDs de los correos que coinciden
            const messages = await client.search(searchCriteria);

            if (messages.length === 0) {
                console.log('📭 No hay correos nuevos de Netflix en este momento.');
                return null;
            }

            console.log(`📬 Se encontraron ${messages.length} correos nuevos. Procesando el último...`);

            // Tomar el UID del correo más reciente
            const ultimoUid = messages[messages.length - 1];

            // 3. Descargar el contenido del correo
            const mensajeRaw = await client.fetchOne(ultimoUid, { source: true });
            
            // Parsear el correo crudo a un objeto manejable
            const parsed = await simpleParser(mensajeRaw.source);
            
            // 4. Extraer el código usando una Expresión Regular
            // Buscamos un bloque de 4 a 6 números seguidos en el texto del correo
            const textoCorreo = parsed.text || parsed.textAsHtml;
            const match = textoCorreo.match(/\b\d{4,6}\b/);

            if (match) {
                const codigo = match[0];
                console.log(`🎉 ¡Código extraído con éxito!: ${codigo}`);
                
                // Opcional: Marcar como leído para que no vuelva a aparecer en la próxima búsqueda
                // await client.messageFlagsAdd({ uid: ultimoUid }, ['\\Seen']);
                
                return codigo;
            } else {
                console.log('❌ Se leyó el correo, pero no se encontró un código numérico válido.');
                return null;
            }

        } finally {
            // Liberar la bandeja de entrada
            lock.release();
        }
    } catch (err) {
        console.error('❌ Error de conexión o lectura:', err);
    } finally {
        await client.logout();
        console.log('🔌 Conexión cerrada.');
    }
}

// Ejecutar la prueba
buscarCodigoNetflix();