import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Telegraf, Markup } from 'telegraf';
import { NetflixExtractor } from './infrastructure/services/NetflixExtractor';
import { PrimeVideoExtractor } from './infrastructure/services/PrimeVideoExtractor';
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
/* ==========================================
// 🛡️ SISTEMA DE CACHÉ DINÁMICA (Lista Blanca)
const whitelistIds = new Set<number>();
const whitelistUsernames = new Set<string>();
const userRepoForWhitelist = new SupabaseUserRepository();

async function syncWhitelist() {
    try {
        const { ids, usernames } = await userRepoForWhitelist.obtenerIdentidadesPermitidas();
        
        whitelistIds.clear();
        whitelistUsernames.clear();
        
        ids.forEach(id => whitelistIds.add(id));
        usernames.forEach(username => whitelistUsernames.add(username));
        
        console.log(`🔄 Lista Blanca sincronizada: ${whitelistIds.size} IDs, ${whitelistUsernames.size} Usernames activos.`);
    } catch (error) {
        console.error('❌ Error sincronizando whitelist:', error);
    }
}

// Ejecutar sincronización al arrancar el servidor
syncWhitelist();
// Programar la sincronización cada 5 minutos (300000 milisegundos)
setInterval(syncWhitelist, 300000);

// 🛑 MIDDLEWARE DE SEGURIDAD ABSOLUTA (El "Cadenenero" Dinámico)
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;

    // Verificamos si el ID o el Username están en nuestra caché RAM
    const isIdAllowed = userId && whitelistIds.has(userId);
    const isUsernameAllowed = username && whitelistUsernames.has(username);

    if (!isIdAllowed && !isUsernameAllowed) {
        // Rechazo silencioso (O(1) complejidad, sin consultas a BD)
        return; 
    }

    return next();
});
========================================== */

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
        try {
            await ctx.answerCbQuery('⏳ Espera unos segundos antes de volver a presionar.');
        } catch (e) {
            console.log('⚠️ Ignorando callback query expirado en cooldown de Netflix');
        }
        return;
    }
    // Actualizamos la hora de su último click
    cooldowns.set(userId, now);

    // 🛡️ DEFENSA 2: Candado de Concurrencia (El proceso de 2 minutos)
    if (activeRequests.has(userId)) {
        try {
            await ctx.answerCbQuery('⚠️ Ya tienes una búsqueda de correo en curso.');
        } catch (e) {
            console.log('⚠️ Ignorando callback query expirado en concurrencia de Netflix');
        }
        return;
    }

    // Le quitamos el "relojito" de carga al botón de manera segura, ignorando errores de expiración
    try {
        await ctx.answerCbQuery(); 
    } catch (e) {
        console.log('⚠️ No se pudo responder al callback query de Netflix (Expirado), continuando flujo...');
    }

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
                // 1. Enviamos el código al usuario
                await ctx.reply(`🎉 ¡Código encontrado!\n\nTu código es: *${codigo}*`, { parse_mode: 'Markdown' });
                
                // 2. 🚨 ALERTA DE ADMINISTRADOR (Silenciosa)
                const adminId = process.env.ADMIN_TELEGRAM_ID;
                if (adminId) {
                    try {
                        // disable_notification: true hace que llegue sin sonido ni vibración
                        await bot.telegram.sendMessage(
                            adminId, 
                            `✅ ÉXITO: Se entregó código de Netflix a @${username || userId}`, 
                            { disable_notification: true }
                        );
                    } catch (error) {
                        console.error('❌ Error enviando alerta al admin:', error);
                    }
                }

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
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    if (!userId) return;

    const now = Date.now();
    const lastClickTime = cooldowns.get(userId) || 0;

    // 🛡️ DEFENSA 1: Rate Limiting (Cooldown de 3 segundos)
    // Si han pasado menos de 3000 milisegundos desde su último click, lo ignoramos.
    if (now - lastClickTime < 3000) {
        try {
            await ctx.answerCbQuery('⏳ Espera unos segundos antes de volver a presionar.');
        } catch (e) {
            console.log('⚠️ Ignorando callback query expirado en cooldown de Prime');
        }
        return; 
    }

    // Actualizamos la hora de su último click
    cooldowns.set(userId, now);

    // 🛡️ DEFENSA 2: Candado de Concurrencia (El proceso de 2 minutos)
    if (activeRequests.has(userId)) {
        try {
            await ctx.answerCbQuery('⚠️ Ya tienes una búsqueda en curso.');
        } catch (e) {
            console.log('⚠️ Ignorando callback query expirado en concurrencia de Prime');
        }
        return;
    }

    // Le quitamos el "relojito" de carga al botón de manera segura, ignorando errores de expiración
    try {
        await ctx.answerCbQuery(); 
    } catch (e) {
        console.log('⚠️ No se pudo responder al callback query de Prime (Expirado), continuando flujo...');
    }

    const userRepository = new SupabaseUserRepository();
    const logRepository = new SupabaseAccessLogRepository();
    const autorizarUseCase = new AutorizarUsuarioUseCase(userRepository);

    try {
        // 1. Consultamos a Supabase (Ahora protegidos por el Cooldown)
        const validacion = await autorizarUseCase.ejecutar({
            telegramId: userId,
            telegramUsername: username,
            serviceName: 'prime_video'
        });

        if (!validacion.isAuthorized) {
            await ctx.reply(validacion.message);
            return;
        }

        // 🛡️ REGLA DE NEGOCIO: Límite de 3 códigos por día
        const exitosHoy = await logRepository.obtenerConteoExitosHoy(validacion.userId as string, 'prime_video');
        if (exitosHoy >= 3) {
            await ctx.reply('🚫 Límite diario alcanzado: Ya has solicitado 3 códigos de Prime Video hoy. Vuelve a intentarlo mañana.');
            return;
        }

        // 📝 Creamos el Log en estado PENDING
        const logId = await logRepository.crearLog(validacion.userId as string, 'prime_video');

        // 2. Pasó la BD. Activamos el Candado Largo e iniciamos IMAP
        activeRequests.add(userId);
        
        await ctx.reply('⏳ Validación exitosa. ⚡ Generando tu código seguro de Prime Video...');

        const extractor = new PrimeVideoExtractor();
        const casoUso = new ObtenerCodigoUseCase(extractor, logRepository);

        // Le pasamos el logId para que pueda actualizarlo
        casoUso.ejecutar(logId).then(async (codigo) => {
            if (codigo) {
                await ctx.reply(`🎉 ¡Código generado!\n\nTu código de Amazon es: *${codigo}*`, { parse_mode: 'Markdown' });
                
                // Aquí va tu Alerta de Administrador que configuramos antes
                const adminId = process.env.ADMIN_TELEGRAM_ID;
                if (adminId) {
                    await bot.telegram.sendMessage(adminId, `✅ ÉXITO: Código Prime entregado a @${username}`, { disable_notification: true }).catch(console.error);
                }
            } else {
                await ctx.reply('❌ Hubo un error al generar el código.');
            }
        }).finally(() => {
            activeRequests.delete(userId);
        });

    } catch (error) {
        console.error('❌ Error en el flujo de autorización:', error);
        await ctx.reply('❌ Ocurrió un error al verificar tus credenciales de acceso.');
    }
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