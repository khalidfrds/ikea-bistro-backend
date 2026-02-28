/**
 * server/src/store/database.ts — SQLite persistent storage
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §2.12, Task Card AGENT 07 PH3
 * Replaces memoryStore.ts (in-memory) from Phase 2.
 * Schema auto-creates on first start. Stores seeded automatically.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Order, PaymentSession, TelegramReceipt, Store } from '../types.js';

const DB_PATH = process.env.SQLITE_PATH || './data/bistro.db';

/** Ensure data directory exists */
function ensureDataDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDataDir();

const db = new Database(DB_PATH);

/** Enable WAL mode for better concurrent read performance */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** ─── Schema ─── */
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number INTEGER NOT NULL,
    lines TEXT NOT NULL,
    total_price REAL NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_session_id TEXT,
    receipt_sent INTEGER DEFAULT 0,
    telegram_user_id TEXT NOT NULL,
    store_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_sessions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'created',
    external_reference TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS receipts (
    order_id TEXT PRIMARY KEY,
    sent INTEGER DEFAULT 0,
    sent_at TEXT
  );

  CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_contexts (
    telegram_user_id TEXT PRIMARY KEY,
    store_id TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    telegram_user_id TEXT NOT NULL,
    menu_item_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (telegram_user_id, menu_item_id)
  );

  CREATE TABLE IF NOT EXISTS order_category_stats (
    category_a TEXT NOT NULL,
    category_b TEXT NOT NULL,
    co_occurrence_count INTEGER DEFAULT 0,
    PRIMARY KEY (category_a, category_b)
  );
`);

/** ─── Order number counter (persisted via SQLite) ─── */
/** We derive next order number from MAX(order_number) + 1, starting at 10. */
export function nextOrderNumber(): number {
  const row = db.prepare('SELECT MAX(order_number) as max_num FROM orders').get() as { max_num: number | null };
  return (row.max_num ?? 9) + 1;
}

/** ─── Orders ─── */

export function saveOrder(order: Order): void {
  db.prepare(`
    INSERT OR REPLACE INTO orders
      (id, order_number, lines, total_price, payment_method, status,
       payment_session_id, receipt_sent, telegram_user_id, store_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order.id,
    order.orderNumber,
    JSON.stringify(order.lines),
    order.totalPrice,
    order.paymentMethod,
    order.status,
    order.paymentSessionId ?? null,
    order.receiptSent ? 1 : 0,
    order.telegramUserId,
    order.storeId,
    order.createdAt
  );
}

function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: row['id'] as string,
    orderNumber: row['order_number'] as number,
    lines: JSON.parse(row['lines'] as string),
    totalPrice: row['total_price'] as number,
    paymentMethod: row['payment_method'] as Order['paymentMethod'],
    status: row['status'] as Order['status'],
    paymentSessionId: (row['payment_session_id'] as string) ?? '',
    receiptSent: (row['receipt_sent'] as number) === 1,
    telegramUserId: row['telegram_user_id'] as string,
    storeId: row['store_id'] as string,
    createdAt: row['created_at'] as string,
  };
}

export function getOrder(orderId: string): Order | undefined {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToOrder(row);
}

export function updateOrder(orderId: string, updates: Partial<Order>): Order | undefined {
  const existing = getOrder(orderId);
  if (!existing) return undefined;
  const merged = { ...existing, ...updates };
  saveOrder(merged);
  return getOrder(orderId);
}

export function getOrdersByUser(telegramUserId: string, limit = 10): Order[] {
  const rows = db.prepare(
    'SELECT * FROM orders WHERE telegram_user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(telegramUserId, limit) as Record<string, unknown>[];
  return rows.map(rowToOrder);
}

/** ─── Payment Sessions ─── */

export function savePaymentSession(session: PaymentSession): void {
  db.prepare(`
    INSERT OR REPLACE INTO payment_sessions
      (id, order_id, method, amount, status, external_reference, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    session.id,
    session.orderId,
    session.method,
    session.amount,
    session.status,
    session.externalReference ?? null,
    session.createdAt,
    session.updatedAt
  );
}

function rowToSession(row: Record<string, unknown>): PaymentSession {
  return {
    id: row['id'] as string,
    orderId: row['order_id'] as string,
    method: row['method'] as PaymentSession['method'],
    amount: row['amount'] as number,
    status: row['status'] as PaymentSession['status'],
    externalReference: (row['external_reference'] as string) ?? '',
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function getPaymentSession(sessionId: string): PaymentSession | undefined {
  const row = db.prepare('SELECT * FROM payment_sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToSession(row);
}

export function getPaymentSessionByExternalRef(externalRef: string): PaymentSession | undefined {
  const row = db.prepare('SELECT * FROM payment_sessions WHERE external_reference = ?').get(externalRef) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return rowToSession(row);
}

export function updatePaymentSession(
  sessionId: string,
  updates: Partial<PaymentSession>
): PaymentSession | undefined {
  const existing = getPaymentSession(sessionId);
  if (!existing) return undefined;
  const merged: PaymentSession = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  savePaymentSession(merged);
  return getPaymentSession(sessionId);
}

/** ─── Receipts ─── */

export function saveReceipt(receipt: TelegramReceipt): void {
  db.prepare(`
    INSERT OR REPLACE INTO receipts (order_id, sent, sent_at)
    VALUES (?, ?, ?)
  `).run(receipt.orderId, receipt.sent ? 1 : 0, receipt.sentAt ?? null);
}

export function getReceipt(orderId: string): TelegramReceipt | undefined {
  const row = db.prepare('SELECT * FROM receipts WHERE order_id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    orderId: row['order_id'] as string,
    sent: (row['sent'] as number) === 1,
    sentAt: (row['sent_at'] as string | null) ?? null,
  };
}

/** ─── Stores ─── */

export function seedStores(stores: Store[]): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO stores (id, name, city, latitude, longitude)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((list: Store[]) => {
    for (const s of list) {
      insert.run(s.id, s.name, s.city, s.latitude, s.longitude);
    }
  });
  insertMany(stores);
}

export function getAllStores(): Store[] {
  const rows = db.prepare('SELECT * FROM stores ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row['id'] as string,
    name: row['name'] as string,
    city: row['city'] as string,
    latitude: row['latitude'] as number,
    longitude: row['longitude'] as number,
  }));
}

export function getStoreById(storeId: string): Store | undefined {
  const row = db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    city: row['city'] as string,
    latitude: row['latitude'] as number,
    longitude: row['longitude'] as number,
  };
}

/** ─── User Contexts ─── */

export interface UserContextRow {
  telegramUserId: string;
  storeId: string | null;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getUserContext(telegramUserId: string): UserContextRow | undefined {
  const row = db.prepare('SELECT * FROM user_contexts WHERE telegram_user_id = ?').get(telegramUserId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    telegramUserId: row['telegram_user_id'] as string,
    storeId: (row['store_id'] as string | null) ?? null,
    notificationsEnabled: (row['notifications_enabled'] as number) === 1,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function upsertUserContext(
  telegramUserId: string,
  storeId: string | null,
  notificationsEnabled: boolean
): UserContextRow {
  const now = new Date().toISOString();
  const existing = getUserContext(telegramUserId);
  if (existing) {
    db.prepare(`
      UPDATE user_contexts
      SET store_id = ?, notifications_enabled = ?, updated_at = ?
      WHERE telegram_user_id = ?
    `).run(storeId, notificationsEnabled ? 1 : 0, now, telegramUserId);
  } else {
    db.prepare(`
      INSERT INTO user_contexts (telegram_user_id, store_id, notifications_enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(telegramUserId, storeId, notificationsEnabled ? 1 : 0, now, now);
  }
  return getUserContext(telegramUserId)!;
}

/** ─── Favorites ─── */

export function getFavoritesByUser(telegramUserId: string): string[] {
  const rows = db.prepare(
    'SELECT menu_item_id FROM favorites WHERE telegram_user_id = ? ORDER BY created_at DESC'
  ).all(telegramUserId) as Record<string, unknown>[];
  return rows.map((r) => r['menu_item_id'] as string);
}

export function toggleFavorite(telegramUserId: string, menuItemId: string): boolean {
  const existing = db.prepare(
    'SELECT 1 FROM favorites WHERE telegram_user_id = ? AND menu_item_id = ?'
  ).get(telegramUserId, menuItemId);

  if (existing) {
    db.prepare('DELETE FROM favorites WHERE telegram_user_id = ? AND menu_item_id = ?')
      .run(telegramUserId, menuItemId);
    return false; // removed
  } else {
    db.prepare('INSERT INTO favorites (telegram_user_id, menu_item_id, created_at) VALUES (?, ?, ?)')
      .run(telegramUserId, menuItemId, new Date().toISOString());
    return true; // added
  }
}

/** ─── Order Category Stats (Smart Upsell) ─── */

export function recordCategoryCoOccurrence(categoryA: string, categoryB: string): void {
  if (categoryA === categoryB) return;
  const [a, b] = [categoryA, categoryB].sort();
  db.prepare(`
    INSERT INTO order_category_stats (category_a, category_b, co_occurrence_count)
    VALUES (?, ?, 1)
    ON CONFLICT(category_a, category_b) DO UPDATE SET
      co_occurrence_count = co_occurrence_count + 1
  `).run(a, b);
}

export function getTopCoOccurringCategories(
  forCategories: string[],
  limit = 3
): string[] {
  if (forCategories.length === 0) return [];
  const placeholders = forCategories.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT
      CASE
        WHEN category_a IN (${placeholders}) THEN category_b
        ELSE category_a
      END AS suggested_category,
      SUM(co_occurrence_count) as total_count
    FROM order_category_stats
    WHERE category_a IN (${placeholders}) OR category_b IN (${placeholders})
    GROUP BY suggested_category
    ORDER BY total_count DESC
    LIMIT ?
  `).all(...forCategories, ...forCategories, ...forCategories, limit) as Record<string, unknown>[];
  return rows
    .map((r) => r['suggested_category'] as string)
    .filter((cat) => !forCategories.includes(cat));
}

export default db;
