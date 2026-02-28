/**
 * server/src/services/notificationService.ts — Telegram push notifications
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §2.9, §4.10
 * Sends "Din beställning är klar!" when order → ready and user has notifications enabled.
 * At most one notification per order-ready transition.
 */

import TelegramBot from 'node-telegram-bot-api';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set — push notifications disabled');
      return null;
    }
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}

/**
 * Send push notification to user when their order is ready.
 * Domain Contract §2.9: sent at most once per order-ready transition.
 * Only if user has notificationsEnabled = true.
 */
export async function sendOrderReadyNotification(
  telegramUserId: string,
  orderNumber: number
): Promise<boolean> {
  const telegramBot = getBot();
  if (!telegramBot) {
    console.log(
      `[PUSH] Order #${orderNumber} ready for user ${telegramUserId} — no bot token, push skipped`
    );
    return false;
  }

  const message =
    `Din beställning är klar! 🎉\nOrdernummer: ${orderNumber}\n\nVisa ditt ordernummer vid utlämningen.`;

  try {
    await telegramBot.sendMessage(telegramUserId, message);
    console.log(`[PUSH] Notification sent for order #${orderNumber} to user ${telegramUserId}`);
    return true;
  } catch (err) {
    console.error(`[PUSH] Failed to send notification for order #${orderNumber}:`, err);
    return false;
  }
}
