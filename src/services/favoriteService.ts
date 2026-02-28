/**
 * server/src/services/favoriteService.ts — Favorites CRUD
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §1.13, §2.11, §4.5, §4.6
 */

import { getFavoritesByUser, toggleFavorite as dbToggleFavorite } from '../store/database.js';

/** 4.5 Get favorites list for user — returns list of menuItemIds */
export function getUserFavorites(telegramUserId: string): string[] {
  return getFavoritesByUser(telegramUserId);
}

/**
 * 4.6 Toggle favorite — add if not present, remove if present.
 * Returns: { isFavorite: true } if added, { isFavorite: false } if removed.
 */
export function toggleUserFavorite(
  telegramUserId: string,
  menuItemId: string
): { menuItemId: string; isFavorite: boolean } {
  const isFavorite = dbToggleFavorite(telegramUserId, menuItemId);
  return { menuItemId, isFavorite };
}
