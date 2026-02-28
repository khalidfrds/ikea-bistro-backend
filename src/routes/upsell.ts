/**
 * server/src/routes/upsell.ts — Smart upsell API
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §2.4
 * GET /api/upsell?cartCategories=cat1,cat2 — return suggested items
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getUpsellSuggestions } from '../services/upsellService.js';

const router = Router();

/** GET /api/upsell — get upsell suggestions based on cart category IDs */
router.get('/', (req: Request, res: Response) => {
  try {
    const cartCategoriesParam = req.query['cartCategories'] as string | undefined;
    const cartCategoryIds = cartCategoriesParam
      ? cartCategoriesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    const suggestions = getUpsellSuggestions(cartCategoryIds);
    res.json({ items: suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/upsell error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
