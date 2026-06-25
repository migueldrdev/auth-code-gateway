import { Telegraf, Markup } from "telegraf";
import { IMessageSender } from "../../domain/interfaces/IMessageSender";
import { ServiceController } from "./controllers/ServiceController";

export const startTelegramBot = (
  token: string,
  netflixController: ServiceController,
  primeController: ServiceController,
): void => {
  const bot = new Telegraf(token);

  // 1. Adapter Factory
  const createTelegramSender = (ctx: any): IMessageSender => ({
    sendMessage: async (msg: string) => {
      await ctx.reply(msg, { parse_mode: "Markdown" });
    },
    showPopup: async (msg?: string) => {
      await ctx.answerCbQuery(msg).catch(() => {});
    },
    notifyAdmin: async (msg: string) => {
      if (process.env.ADMIN_TELEGRAM_ID) {
        await bot.telegram
          .sendMessage(process.env.ADMIN_TELEGRAM_ID, msg, {
            disable_notification: true,
          })
          .catch(() => {});
      }
    },
  });

  // 🛡️ AGREGAR ESTO: ESCUDO GLOBAL DE TELEGRAM
  bot.catch((err: any, ctx) => {
    console.error(
      `❌ Error Global de Telegraf (Ignorado para mantener el bot vivo):`,
      err.message || err,
    );
  });

  // 2. Routing (Comandos y Botones)
  bot.command("start", async (ctx) => {
    const username = ctx.from.username || "User";
    await ctx.reply(
      `¡Hola, ${username}! Bienvenido al Gateway de Accesos.\n\nSelecciona el servicio:`,
      Markup.inlineKeyboard([
        Markup.button.callback("🔴 Netflix", "action_netflix"),
        Markup.button.callback("🔵 Prime Video", "action_prime"),
      ]),
    );
    console.log("🤖 Telegram Bot initialized...");
  });

  bot.action("action_netflix", async (ctx) => {
    if (ctx.from?.id)
      await netflixController.handle(
        ctx.from.id,
        ctx.from.username || "Unknown",
        createTelegramSender(ctx),
      );
  });

  bot.action("action_prime", async (ctx) => {
    if (ctx.from?.id)
      await primeController.handle(
        ctx.from.id,
        ctx.from.username || "Unknown",
        createTelegramSender(ctx),
      );
  });

  bot.on("text", async (ctx) => {
    if (!ctx.message.text.startsWith("/")) {
      await ctx.reply(
        "🤖 Solo puedo procesar comandos. Escribe /start para ver el menú.",
      );
    }
  });

  // 3. Launch
  bot
    .launch()
    .then(() => {
      console.log("🤖 Telegram Bot connected and running...");
    })
    .catch((err) => {
      console.error(
        "❌ Error de conexión con Telegram (Posible micro-corte de red):",
        err.message,
      );
      console.log(
        "⚠️ El servidor Express sigue vivo, pero el bot requerirá reinicio cuando vuelva la señal.",
      );
    });

  // Graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
};
