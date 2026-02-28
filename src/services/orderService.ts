/**
 * server/src/services/orderService.ts — Order management
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §2.5, §2.6, §2.7, §2.9, §4.1–§4.4
 * Business rules:
 *   - Order created with status=pending, sequential orderNumber
 *   - Order confirmed only via payment system (not client device) — HOTFIX preserved
 *   - Receipt sent only after confirmed status — HOTFIX preserved
 *   - On ready: send push notification if user has notifications enabled
 *   - telegramUserId + storeId required on order create
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Order,
  OrderLine,
  PaymentMethod,
  OrderStatus,
  CreateOrderRequest,
  CreateOrderResponse,
  OrderStatusResponse,
  OrderHistoryEntry,
} from '../types.js';
import {
  saveOrder,
  getOrder,
  updateOrder,
  nextOrderNumber,
  getOrdersByUser,
  getStoreById,
  recordCategoryCoOccurrence,
  getUserContext,
} from '../store/database.js';
import { createPaymentForOrder } from './paymentService.js';
import { sendTelegramReceipt } from './receiptService.js';
import { sendOrderReadyNotification } from './notificationService.js';
import { serverMenuById } from '../data/menu.js';

/** 4.1 Create Order — Domain Contract §2.5, §2.6 */
export async function createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
  if (request.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  if (!request.telegramUserId) {
    throw new Error('telegramUserId is required');
  }

  if (!request.storeId) {
    throw new Error('storeId is required for order creation');
  }

  const storeExists = getStoreById(request.storeId);
  if (!storeExists) {
    throw new Error(`Invalid storeId: ${request.storeId}`);
  }

  const orderId = uuidv4();
  const orderNumber = nextOrderNumber();

  /**
   * Domain Contract §2.7 (HOTFIX from Phase 2, preserved):
   * Server recomputes prices from server-side menu. Client-provided prices are ignored.
   */
  const lines: OrderLine[] = request.items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error('Invalid quantity. Must be an integer >= 1');
    }
    const menuItem = serverMenuById[item.menuItemId];
    if (!menuItem) {
      throw new Error(`Invalid menuItemId: ${item.menuItemId}`);
    }
    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity: item.quantity,
      priceAtOrder: menuItem.price,
    };
  });

  const totalPrice = lines.reduce((sum, line) => sum + line.quantity * line.priceAtOrder, 0);

  /** Create payment session via paymentService */
  const paymentResult = await createPaymentForOrder(orderId, totalPrice, request.paymentMethod);

  const order: Order = {
    id: orderId,
    orderNumber,
    lines,
    totalPrice,
    paymentMethod: request.paymentMethod,
    status: 'pending',
    paymentSessionId: paymentResult.sessionId,
    receiptSent: false,
    telegramUserId: request.telegramUserId,
    storeId: request.storeId,
    createdAt: new Date().toISOString(),
  };

  saveOrder(order);

  /** Domain Contract §2.4 Smart Upsell — record category co-occurrences */
  const menuItems = request.items.map((item) => serverMenuById[item.menuItemId]).filter(Boolean);
  const itemsWithCat = menuItems as Array<{ id: string; name: string; price: number; categoryId?: string }>;
  const categoryIds = [...new Set(itemsWithCat.map((m) => m.categoryId).filter((c): c is string => Boolean(c)))];
  for (let i = 0; i < categoryIds.length; i++) {
    for (let j = i + 1; j < categoryIds.length; j++) {
      recordCategoryCoOccurrence(categoryIds[i], categoryIds[j]);
    }
  }

  const response: CreateOrderResponse = {
    orderId,
    orderNumber,
    status: 'pending',
    paymentSessionId: paymentResult.sessionId,
    amount: totalPrice,
  };

  if (paymentResult.clientSecret) {
    response.clientSecret = paymentResult.clientSecret;
  }
  if (paymentResult.checkoutUrl) {
    response.checkoutUrl = paymentResult.checkoutUrl;
  }
  if (paymentResult.swishUrl) {
    response.swishUrl = paymentResult.swishUrl;
  }

  return response;
}

/**
 * 4.2 Confirm Order — called after successful payment verification
 * CRITICAL HOTFIX (Phase 2, preserved): called ONLY from payment webhook, not from client.
 * Domain Contract §2.7: server-to-server confirmation only.
 */
export async function confirmOrder(
  orderId: string
): Promise<Order | undefined> {
  const order = updateOrder(orderId, { status: 'confirmed' as OrderStatus });
  if (!order) return undefined;

  /** Domain Contract §2.8: send receipt to the user who placed the order */
  try {
    const receiptOk = await sendTelegramReceipt(order, order.telegramUserId);
    if (receiptOk) {
      updateOrder(orderId, { receiptSent: true });
    }
  } catch (err) {
    console.error('Receipt send failed, order stays confirmed:', err);
  }

  /**
   * Kitchen progression: confirmed → ready after 30s.
   * Triggers push notification on ready if user has notifications enabled.
   */
  setTimeout(() => {
    try {
      markOrderReady(orderId).catch((err) => {
        console.error('Failed to mark order ready:', err);
      });
    } catch (err) {
      console.error('Failed to mark order ready:', err);
    }
  }, 30_000);

  return getOrder(orderId);
}

/**
 * Mark order as ready — triggers push notification (Domain Contract §2.9)
 * Also callable via POST /api/orders/:id/ready
 */
export async function markOrderReady(orderId: string): Promise<Order | undefined> {
  const order = getOrder(orderId);
  if (!order) return undefined;
  if (order.status !== 'confirmed') return order;

  updateOrder(orderId, { status: 'ready' as OrderStatus });

  /** Domain Contract §2.9: send push notification if enabled */
  try {
    const userCtx = getUserContext(order.telegramUserId);
    if (userCtx && userCtx.notificationsEnabled) {
      await sendOrderReadyNotification(order.telegramUserId, order.orderNumber);
    }
  } catch (err) {
    console.error('Push notification failed:', err);
  }

  return getOrder(orderId);
}

/** 4.3 Get Order Status */
export function getOrderStatus(orderId: string): OrderStatusResponse | undefined {
  const order = getOrder(orderId);
  if (!order) return undefined;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalPrice: order.totalPrice,
    paymentMethod: order.paymentMethod,
    receiptSent: order.receiptSent,
    storeId: order.storeId,
  };
}

/** 4.4 Get Order History for user (Domain Contract §2.10: last N, newest first) */
export function getUserOrderHistory(
  telegramUserId: string,
  limit = 10
): OrderHistoryEntry[] {
  const orders = getOrdersByUser(telegramUserId, limit);
  return orders.map((order) => {
    const store = getStoreById(order.storeId);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      totalPrice: order.totalPrice,
      status: order.status,
      storeId: order.storeId,
      storeName: store?.name ?? order.storeId,
      lines: order.lines,
    };
  });
}
