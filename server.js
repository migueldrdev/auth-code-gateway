require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const PORT = process.env.PORT || 3000;

// Middleware básico para parsear JSON
app.use(express.json());

// 1. Ruta de estado (Health Check)
// Es vital para que Render.com sepa que tu servidor no se ha caído
app.get('/', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Servidor del Gateway Activo 🚀' });
});

// 2. Comando básico del Bot de Telegram
bot.command('codigo', (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Usuario';
    
    // Aquí el bot nos dará el ID exacto que luego usaremos para la base de datos
    ctx.reply(`¡Hola ${username}! He recibido tu solicitud. Tu ID de Telegram es: ${userId}.\n\nEn el próximo Sprint conectaremos esto con la extracción de correos.`);
    
    console.log(`📩 Solicitud recibida del usuario ID: ${userId}`);
});

// 3. Inicialización del Servidor y el Bot
app.listen(PORT, () => {
    console.log(`🌐 Servidor Express escuchando en el puerto ${PORT}`);
    
    // Iniciar el bot en modo "Polling" (Ideal para desarrollo local)
    bot.launch();
    console.log('🤖 Bot de Telegram conectado y esperando comandos...');
});

// 4. Manejo de cierre seguro (Graceful shutdown)
// Buena práctica de ingeniería para no dejar procesos colgados
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));