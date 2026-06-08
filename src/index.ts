import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Telegraf, Markup } from 'telegraf';
import { NetflixExtractor } from './infrastructure/services/NetflixExtractor';
import { ObtenerCodigoUseCase } from './application/use-cases/ObtenerCodigoUseCase';
import { SupabaseUserRepository } from './infrastructure/repositories/SupabaseUserRepository';
import { AutorizarUsuarioUseCase } from './application/use-cases/AutorizarUsuarioUseCase';
import { SupabaseAccessLogRepository } from './infrastructure/repositories/SupabaseAccessLogRepository';

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.TELEGRAM_TOKEN) {
    throw new Error('❌ TELEGRAM_TOKEN no está definido en el archivo .env');
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
app.use(express.json());

// 🛡️ SISTEMA DE PROTECCIÓN DOBLE
// 1. Candado para procesos largos (IMAP - 2 minutos)
const activeRequests = new Set<number>();
// 2. Cooldown para evitar spam a la Base de Datos (3 segundos)
const cooldowns = new Map<number, number>();

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', message: 'Servidor del Gateway Activo 🚀' });
});

// 🛡️ LISTA BLANCA (Whitelisting)
// Coloca aquí los IDs numéricos de tus 4-6 usuarios de confianza
const ALLOWED_USERS = [
    5633294939, // Tu ID de Telegram
];

// 🛑 MIDDLEWARE DE SEGURIDAD ABSOLUTA (El "Cadenenero")
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    
    // Si el usuario no tiene ID o no está en nuestra lista VIP, lo ignoramos.
    // El 'return' vacío hace que el bot no haga NADA. No consume base de datos, 
    // y el usuario que hace spam sentirá que el bot está apagado o roto.
    if (!userId || !ALLOWED_USERS.includes(userId)) {
        console.warn(`🚨 Intento de acceso bloqueado del usuario no autorizado: ${userId}`);
        return; 
    }

    // Si está en la lista blanca, le damos pase al resto del código (/start, botones, etc.)
    return next();
});

bot.command('start', async (ctx) => {
    const username = ctx.from.username || 'Usuario';
    await ctx.reply(`¡Hola, ${username}! Bienvenido al Gateway de Accesos.\n\nSelecciona el servicio del que necesitas el código:`, 
        Markup.inlineKeyboard([
            Markup.button.callback('🔴 Netflix', 'action_netflix'),
            Markup.button.callback('🔵 Prime Video', 'action_prime') 
        ])
    );
});

bot.action('action_netflix', async (ctx) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    if (!userId) return;

    const now = Date.now();
    const lastClickTime = cooldowns.get(userId) || 0;

    // 🛡️ DEFENSA 1: Rate Limiting (Cooldown de 3 segundos)
    // Si han pasado menos de 3000 milisegundos desde su último click, lo ignoramos.
    if (now - lastClickTime < 3000) {
        // Usamos answerCbQuery para mostrarle un popup sutil arriba sin ensuciar el chat
        await ctx.answerCbQuery('⏳ Espera unos segundos antes de volver a presionar.');
        return; 
    }
    // Actualizamos la hora de su último click
    cooldowns.set(userId, now);

    // 🛡️ DEFENSA 2: Candado de Concurrencia (El proceso de 2 minutos)
    if (activeRequests.has(userId)) {
        await ctx.answerCbQuery('⚠️ Ya tienes una búsqueda de correo en curso.');
        return;
    } 

    // Le quitamos el "relojito" de carga al botón
    await ctx.answerCbQuery(); 

    const userRepository = new SupabaseUserRepository();
    const logRepository = new SupabaseAccessLogRepository();
    const autorizarUseCase = new AutorizarUsuarioUseCase(userRepository);

    try {
        // 1. Consultamos a Supabase (Ahora protegidos por el Cooldown)
        const validacion = await autorizarUseCase.ejecutar({
            telegramId: userId,
            telegramUsername: username,
            serviceName: 'netflix'
        });

        if (!validacion.isAuthorized) {
            await ctx.reply(validacion.message);
            return;
        }

        // 🛡️ REGLA DE NEGOCIO: Límite de 3 códigos por día
        const exitosHoy = await logRepository.obtenerConteoExitosHoy(validacion.userId as string, 'netflix');
        if (exitosHoy >= 3) {
            await ctx.reply('🚫 Límite diario alcanzado: Ya has solicitado 3 códigos de Netflix hoy. Vuelve a intentarlo mañana.');
            return;
        }

        // 📝 Creamos el Log en estado PENDING
        const logId = await logRepository.crearLog(validacion.userId as string, 'netflix');

        // 2. Pasó la BD. Activamos el Candado Largo e iniciamos IMAP
        activeRequests.add(userId);
        
        await ctx.reply('⏳ Validación exitosa. Iniciando búsqueda del código de Netflix. Por favor, dale "Enviar código" en tu pantalla ahora...');

        const extractor = new NetflixExtractor();
        const casoUso = new ObtenerCodigoUseCase(extractor, logRepository);

        // Le pasamos el logId para que pueda actualizarlo
        casoUso.ejecutar(logId).then(async (codigo) => {
            if (codigo) {
                await ctx.reply(`🎉 ¡Código encontrado!\n\nTu código es: *${codigo}*`, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply('⏰ Tiempo agotado. No hemos recibido el correo.');
            }
        }).catch(async (error) => {
            console.error(`❌ Error general:`, error);
            await ctx.reply('❌ Ocurrió un error interno al intentar leer la bandeja.');
        }).finally(() => {
            activeRequests.delete(userId);
        });

    } catch (error) {
        console.error('❌ Error en el flujo de autorización:', error);
        await ctx.reply('❌ Ocurrió un error al verificar tus credenciales de acceso.');
    }
});

bot.action('action_prime', async (ctx) => {
    await ctx.answerCbQuery('Aún en desarrollo 🛠️');
    await ctx.reply('La integración con Prime Video estará disponible en el próximo Sprint.');
});

bot.on('text', async (ctx) => {
    if (!ctx.message.text.startsWith('/')) {
        await ctx.reply('🤖 Solo puedo procesar comandos. Por favor, escribe /start para ver el menú interactivo.');
    }
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor Express escuchando en el puerto ${PORT}`);
    bot.launch();
    console.log('🤖 Bot de Telegram conectado con Validación Supabase...');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));