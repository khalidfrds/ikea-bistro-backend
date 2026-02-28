/**
 * server/src/services/receiptService.ts — Telegram receipt
 * Source: Domain Contract v2.0 §1.9, §2.7
 * Business rules:
 *   - Receipt sent only after order status = confirmed
 *   - Max one receipt per order
 *   - Format: header, items list, total, payment method, order number, date, footer
 */

import TelegramBot from 'node-telegram-bot-api';
import type { Order } from '../types.js';
import { saveReceipt, getReceipt } from '../store/database.js';

let bot: TelegramBot | null = null;

function getBot(): TelegramBot | null {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.warn('TELEGRAM_BOT_TOKEN not set, receipts will be logged only');
      return null;
    }
    bot = new TelegramBot(token, { polling: false });
  }
  return bot;
}

/** Format payment method name in Swedish */
function formatPaymentMethod(method: string): string {
  if (method === 'card') return 'Betalkort';
  if (method === 'swish') return 'Swish';
  return method;
}

/** Format date for receipt */
function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/** Build receipt message text (Domain Contract §1.9) */
function buildReceiptMessage(order: Order): string {
  const header = '\u{1F9FE} IKEA Bistro \u2014 Kvitto';

  const itemLines = order.lines
    .map((line) => {
      const lineTotal = line.quantity * line.priceAtOrder;
      return `${line.name} \u00D7 ${line.quantity} \u2014 ${lineTotal} SEK`;
    })
    .join('\n');

  const total = `Totalt: ${order.totalPrice} SEK`;
  const payment = `Betalning: ${formatPaymentMethod(order.paymentMethod)}`;
  const orderNum = `Ordernummer: ${order.orderNumber}`;
  const date = formatDate(order.createdAt);
  const footer = 'Visa vid utl\u00E4mningen. Tack!';

  return `${header}\n\n${itemLines}\n\n${total}\n${payment}\n${orderNum}\n${date}\n\n${footer}`;
}

/** Send receipt to Telegram chat (Domain Contract §2.7) */
export async function sendTelegramReceipt(
  order: Order,
  chatId: string
): Promise<boolean> {
  /** Check: max one receipt per order */
  const existing = getReceipt(order.id);
  if (existing && existing.sent) {
    console.log('Receipt already sent for order:', order.id);
    return true;
  }

  const message = buildReceiptMessage(order);
  const telegramBot = getBot();

  if (telegramBot) {
    try {
      await telegramBot.sendMessage(chatId, message);
      saveReceipt({
        orderId: order.id,
        sent: true,
        sentAt: new Date().toISOString()
      });
      console.log('Receipt sent for order:', order.orderNumber);
      return true;
    } catch (err) {
      console.error('Telegram sendMessage failed:', err);
      saveReceipt({
        orderId: order.id,
        sent: false,
        sentAt: null
      });
      return false;
    }
  }

  /** Fallback: log receipt to console if no bot token */
  console.log('=== TELEGRAM RECEIPT (not sent — no bot token) ===');
  console.log(message);
  console.log('=== END RECEIPT ===');
  saveReceipt({
    orderId: order.id,
    sent: false,
    sentAt: null
  });
  return false;
}
