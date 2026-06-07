import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Telegraf, Markup } from 'telegraf';
import { NetflixExtractor } from './infrastructure/services/NetflixExtractor';
import { ObtenerCodigoUseCase } from './application/use-cases/ObtenerCodigoUseCase';

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.TELEGRAM_TOKEN) {
    throw new Error('❌ TELEGRAM_TOKEN no está definido en el archivo .env');
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
app.use(express.json());

// 🛡️ SISTEMA DE CANDADOS (Anti-Spam)
// Guarda los IDs de los usuarios que tienen una búsqueda en progreso
const activeRequests = new Set<number>();

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'Servidor del Gateway Activo 🚀' });
});

// 1. Comando /start (Menú con Botones)
bot.command('start', async (ctx) => {
    const username = ctx.from.username || 'Usuario';
    
    // Enviamos un mensaje con un teclado en línea (Inline Keyboard)
    await ctx.reply(`¡Hola, ${username}! Bienvenido al Gateway de Accesos.\n\nSelecciona el servicio del que necesitas el código:`, 
        Markup.inlineKeyboard([
            // Primer parámetro: Texto visible | Segundo parámetro: ID de la acción oculta
            Markup.button.callback('🔴 Netflix', 'action_netflix'),
            // Puedes ir preparando el botón de Prime para el futuro
            Markup.button.callback('🔵 Prime Video', 'action_prime') 
        ])
    );
});

// 2. Manejador de la acción del botón de Netflix
bot.action('action_netflix', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Telegraf requiere que respondamos a la interacción del botón para quitar el "relojito" de carga en la app
    await ctx.answerCbQuery(); 

    // 🛡️ VALIDACIÓN ANTI-SPAM
    if (activeRequests.has(userId)) {
        await ctx.reply('⚠️ Ya tienes una búsqueda en curso. Por favor espera a que termine o se agote el tiempo.');
        return;
    }

    // Bloqueamos al usuario añadiéndolo al Set
    activeRequests.add(userId);
    console.log(`📩 Solicitud de código NETFLIX del usuario ID: ${userId}`);

    await ctx.reply('⏳ Iniciando búsqueda del código de Netflix. Por favor, dale "Enviar código" en tu TV ahora. Esperando correo...');

    const extractor = new NetflixExtractor();
    const casoUso = new ObtenerCodigoUseCase(extractor);

    casoUso.ejecutar().then(async (codigo) => {
        if (codigo) {
            await ctx.reply(`🎉 ¡Código encontrado!\n\nTu código de acceso es: *${codigo}*`, { parse_mode: 'Markdown' });
        } else {
            await ctx.reply('⏰ Tiempo agotado. No hemos recibido un correo reciente con el código. Por favor, vuelve a intentarlo desde el menú /start.');
        }
    }).catch(async (error) => {
        console.error(`❌ Error en la extracción:`, error);
        await ctx.reply('❌ Ocurrió un error interno al intentar leer la bandeja.');
    }).finally(() => {
        // 🔓 LIBERAMOS AL USUARIO (Independientemente de si hubo éxito o error)
        activeRequests.delete(userId);
        console.log(`🔓 Candado liberado para el usuario ${userId}`);
    });
});

// Manejador temporal para el botón de Prime (Para que no de error si lo tocan)
bot.action('action_prime', async (ctx) => {
    await ctx.answerCbQuery('Aún en desarrollo 🛠️'); // Sale como un popup temporal en Telegram
    await ctx.reply('La integración con Prime Video estará disponible en el próximo Sprint.');
});

// 3. Manejador de texto normal (Fallback)
bot.on('text', async (ctx) => {
    // Si el usuario escribe texto random que no sea comando (y que no empiece con /)
    if (!ctx.message.text.startsWith('/')) {
        await ctx.reply('🤖 Solo puedo procesar comandos. Por favor, escribe /start para ver el menú interactivo.');
    }
});

// Inicialización
app.listen(PORT, () => {
    console.log(`🌐 Servidor Express escuchando en el puerto ${PORT}`);
    bot.launch();
    console.log('🤖 Bot de Telegram conectado con Interfaz Interactiva...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));