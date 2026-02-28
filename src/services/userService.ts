/**
 * server/src/services/userService.ts — User context CRUD
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §1.12, §4.8, §4.9
 */

import { getUserContext, upsertUserContext } from '../store/database.js';
import type { UserContext } from '../types.js';

/** Get user context — returns null if not found */
export function getContext(telegramUserId: string): UserContext | null {
  const row = getUserContext(telegramUserId);
  if (!row) return null;
  return {
    telegramUserId: row.telegramUserId,
    storeId: row.storeId,
    notificationsEnabled: row.notificationsEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 4.8 + 4.9 Set/update user context (store + notifications) */
export function setContext(
  telegramUserId: string,
  storeId: string | null,
  notificationsEnabled: boolean
): UserContext {
  const row = upsertUserContext(telegramUserId, storeId, notificationsEnabled);
  return {
    telegramUserId: row.telegramUserId,
    storeId: row.storeId,
    notificationsEnabled: row.notificationsEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
