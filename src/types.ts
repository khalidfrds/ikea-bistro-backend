/**
 * server/src/types.ts — Backend domain types
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 (FROZEN)
 * Extended from Phase 2: adds Store, UserContext, Favorite, OrderHistoryEntry
 */

/** 1.5 Payment Method */
export type PaymentMethod = 'card' | 'swish';

/** 1.6 Order Status — lifecycle: pending → confirmed → ready */
export type OrderStatus = 'pending' | 'confirmed' | 'ready';

/** 1.8 Payment Session Status — lifecycle: created → processing → succeeded / failed */
export type PaymentSessionStatus = 'created' | 'processing' | 'succeeded' | 'failed';

/** Order line item — snapshot of item at order creation time */
export interface OrderLine {
  menuItemId: string;
  name: string;
  quantity: number;
  priceAtOrder: number;
}

/** 1.7 Payment Session — links order to payment provider */
export interface PaymentSession {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentSessionStatus;
  externalReference: string;
  createdAt: string;
  updatedAt: string;
}

/** 1.15 Order (Phase 3) — extended with telegramUserId + storeId */
export interface Order {
  id: string;
  orderNumber: number;
  lines: OrderLine[];
  totalPrice: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  paymentSessionId: string;
  receiptSent: boolean;
  telegramUserId: string;
  storeId: string;
  createdAt: string;
}

/** 1.9 Telegram Receipt */
export interface TelegramReceipt {
  orderId: string;
  sent: boolean;
  sentAt: string | null;
}

/** 1.10 Store (Phase 3) */
export interface Store {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
}

/** 1.12 User Context (Phase 3) */
export interface UserContext {
  telegramUserId: string;
  storeId: string | null;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 1.14 Order History Entry (Phase 3) */
export interface OrderHistoryEntry {
  orderId: string;
  orderNumber: number;
  createdAt: string;
  totalPrice: number;
  status: OrderStatus;
  storeId: string;
  storeName: string;
  lines: OrderLine[];
}

/** API request: create order (Phase 3 — adds telegramUserId + storeId) */
export interface CreateOrderRequest {
  items: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  paymentMethod: PaymentMethod;
  telegramUserId: string;
  storeId: string;
  telegramChatId?: string;
}

/** API response: create order */
export interface CreateOrderResponse {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  paymentSessionId: string;
  amount: number;
  clientSecret?: string;
  checkoutUrl?: string;
  swishUrl?: string;
}

/** API response: get order status */
export interface OrderStatusResponse {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  receiptSent: boolean;
  storeId: string;
}

/** API request: set user context */
export interface SetUserContextRequest {
  telegramUserId: string;
  storeId: string | null;
  notificationsEnabled: boolean;
}

/** API response: order history */
export interface OrderHistoryResponse {
  entries: OrderHistoryEntry[];
}

/** API response: favorites */
export interface FavoritesResponse {
  menuItemIds: string[];
}

/** API request: toggle favorite */
export interface ToggleFavoriteRequest {
  telegramUserId: string;
  menuItemId: string;
}

/** API response: toggle favorite */
export interface ToggleFavoriteResponse {
  menuItemId: string;
  isFavorite: boolean;
}
