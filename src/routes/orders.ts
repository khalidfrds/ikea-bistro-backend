/**
 * server/src/routes/orders.ts — Order API routes
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §4.1, §4.3, §4.4
 * POST /api/orders                        — create order (requires telegramUserId + storeId)
 * GET  /api/orders/:id                    — get order status
 * GET  /api/orders/history/:telegramUserId — last N orders (Phase 3)
 * POST /api/orders/:id/ready              — mark order ready (triggers push)
 *
 * CRITICAL HOTFIX (Phase 2, preserved):
 * Payment confirmation only via Stripe/Swish webhook (server-to-server).
 * No client-facing confirm endpoint.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import type { CreateOrderRequest } from '../types.js';
import { createOrder, getOrderStatus, getUserOrderHistory, markOrderReady } from '../services/orderService.js';

const router = Router();

/** Helper: safely extract a single string from req.query or req.params value */
function str(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

/** GET /api/orders/history/:telegramUserId — order history (Phase 3) */
router.get('/history/:telegramUserId', (req: Request, res: Response) => {
  try {
    const { telegramUserId } = req.params;
    const limitParam = typeof req.query['limit'] === 'string' ? req.query['limit'] : undefined;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 50) : 10;

    const entries = getUserOrderHistory(telegramUserId, limit);
    res.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/orders/history error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /api/orders — Create a new order from cart */
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateOrderRequest;

    if (!body.items || body.items.length === 0) {
      res.status(400).json({ error: 'Order must contain at least one item' });
      return;
    }

    if (!body.paymentMethod || !['card', 'swish'].includes(body.paymentMethod)) {
      res.status(400).json({ error: 'Invalid payment method. Must be "card" or "swish"' });
      return;
    }

    if (!body.telegramUserId) {
      res.status(400).json({ error: 'telegramUserId is required' });
      return;
    }

    if (!body.storeId) {
      res.status(400).json({ error: 'storeId is required' });
      return;
    }

    const result = await createOrder(body);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('POST /api/orders error:', message);

    if (
      typeof message === 'string' &&
      (message.startsWith('Invalid') ||
        message.includes('must') ||
        message.includes('required') ||
        message.includes('not configured'))
    ) {
      res.status(400).json({ error: message });
      return;
    }

    res.status(500).json({ error: message });
  }
});

/** GET /api/orders/:id — Get order status */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const orderId = str(req.params['id']) ?? '';
    const result = getOrderStatus(orderId);

    if (!result) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/orders/:id error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /api/orders/:id/ready — mark order ready (triggers push notification) */
router.post('/:id/ready', async (req: Request, res: Response) => {
  try {
    const orderId = str(req.params['id']) ?? '';
    const order = await markOrderReady(orderId);

    if (!order) {
      res.status(404).json({ error: 'Order not found or not in confirmed state' });
      return;
    }

    res.json({ orderId: order.id, status: order.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('POST /api/orders/:id/ready error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
