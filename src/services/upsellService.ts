/**
 * server/src/services/upsellService.ts — Smart upsell via co-occurrence stats
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §2.4
 * Rule: suggest items from categories not already in cart.
 * Smart: prefer categories that co-occur with cart categories.
 * Fallback: static upsell pool from different categories.
 */

import { getTopCoOccurringCategories } from '../store/database.js';
import { serverMenuItems } from '../data/menu.js';

/** Static fallback upsell item IDs (from different categories) */
const STATIC_UPSELL_IDS = ['kanelbulle', 'coffee', 'fountain_drink', 'icecream_basic'];

/**
 * Get upsell suggestions — items from categories not in cartCategoryIds.
 * Uses co-occurrence stats if available, falls back to static pool.
 */
export function getUpsellSuggestions(
  cartCategoryIds: string[]
): Array<{ itemId: string; name: string; price: number; categoryId: string }> {
  const cartCatSet = new Set(cartCategoryIds);

  // Get co-occurring categories from stats
  const suggestedCategories = getTopCoOccurringCategories(cartCategoryIds, 3);

  const results: Array<{ itemId: string; name: string; price: number; categoryId: string }> = [];
  const usedCategories = new Set<string>();

  // First: items from suggested co-occurring categories
  for (const catId of suggestedCategories) {
    if (cartCatSet.has(catId)) continue;
    const item = serverMenuItems.find(
      (m) => (m as { id: string; name: string; price: number; categoryId?: string }).categoryId === catId
    );
    if (item) {
      results.push({
        itemId: item.id,
        name: item.name,
        price: item.price,
        categoryId: catId,
      });
      usedCategories.add(catId);
    }
    if (results.length >= 3) break;
  }

  // Fallback: static items from categories not in cart
  if (results.length < 3) {
    for (const itemId of STATIC_UPSELL_IDS) {
      if (results.length >= 3) break;
      const item = serverMenuItems.find((m) => m.id === itemId);
      if (!item) continue;
      const mItem = item as { id: string; name: string; price: number; categoryId?: string };
      const catId = mItem.categoryId ?? '';
      if (cartCatSet.has(catId)) continue;
      if (usedCategories.has(catId)) continue;
      results.push({
        itemId: mItem.id,
        name: mItem.name,
        price: mItem.price,
        categoryId: catId,
      });
      usedCategories.add(catId);
    }
  }

  return results;
}
