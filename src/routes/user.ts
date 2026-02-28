/**
 * server/src/routes/user.ts — User context API
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §4.8, §4.9
 * GET  /api/user/context/:telegramUserId — get context
 * POST /api/user/context                 — set/update context
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getContext, setContext } from '../services/userService.js';
import type { SetUserContextRequest } from '../types.js';

const router = Router();

/** GET /api/user/context/:telegramUserId */
router.get('/context/:telegramUserId', (req: Request, res: Response) => {
  try {
    const { telegramUserId } = req.params;
    if (!telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }

    const context = getContext(telegramUserId);
    if (!context) {
      res.status(404).json({ error: 'User context not found' });
      return;
    }

    res.json(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/user/context error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /api/user/context */
router.post('/context', (req: Request, res: Response) => {
  try {
    const body = req.body as SetUserContextRequest;

    if (!body.telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }

    const notificationsEnabled =
      typeof body.notificationsEnabled === 'boolean' ? body.notificationsEnabled : true;

    const context = setContext(body.telegramUserId, body.storeId ?? null, notificationsEnabled);
    res.json(context);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('POST /api/user/context error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
