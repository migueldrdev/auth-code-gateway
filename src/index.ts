import 'dotenv/config';
import { createServer } from './infrastructure/web/server';
import { startTelegramBot } from './infrastructure/bot/TelegramRouter';
import { netflixController, primeController } from './infrastructure/di/container';

if (!process.env.TELEGRAM_TOKEN) {
    throw new Error('❌ TELEGRAM_TOKEN is not defined in the .env file');
}

const PORT = process.env.PORT || 3000;

// 1. Boot Express Web Server
const app = createServer();
app.listen(PORT, () => {
    console.log(`🌐 Express Server listening on port ${PORT}`);
});

// 2. Boot Telegram Bot Adapter
startTelegramBot(
    process.env.TELEGRAM_TOKEN,
    netflixController,
    primeController
);