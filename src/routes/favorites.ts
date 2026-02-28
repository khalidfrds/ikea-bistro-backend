/**
 * server/src/routes/favorites.ts — Favorites API
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §4.5, §4.6
 * GET  /api/favorites/:telegramUserId  — list favorites
 * POST /api/favorites/toggle           — toggle favorite
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getUserFavorites, toggleUserFavorite } from '../services/favoriteService.js';
import type { ToggleFavoriteRequest } from '../types.js';

const router = Router();

/** GET /api/favorites/:telegramUserId — list user's favorite menuItemIds */
router.get('/:telegramUserId', (req: Request, res: Response) => {
  try {
    const { telegramUserId } = req.params;
    if (!telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }

    const menuItemIds = getUserFavorites(telegramUserId);
    res.json({ menuItemIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/favorites error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /api/favorites/toggle — add or remove favorite */
router.post('/toggle', (req: Request, res: Response) => {
  try {
    const body = req.body as ToggleFavoriteRequest;

    if (!body.telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }
    if (!body.menuItemId) {
      res.status(400).json({ error: 'menuItemId is required' });
      return;
    }

    const result = toggleUserFavorite(body.telegramUserId, body.menuItemId);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('POST /api/favorites/toggle error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
