/**
 * server/src/routes/webhooks.ts — Payment provider webhooks
 * Source: Domain Contract v2.0 §4.2
 * POST /api/webhooks/stripe — Stripe webhook handler
 * POST /api/webhooks/swish — Swish callback handler
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  handleStripeWebhook,
  handleSwishCallback
} from '../services/paymentService.js';

const router = Router();

/** POST /api/webhooks/stripe — Stripe webhook
 *  Note: uses raw body for signature verification. Express raw body
 *  must be available via req.body (Buffer) for this route. */
router.post('/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    const rawBody = req.body as Buffer;
    const result = await handleStripeWebhook(rawBody, signature);

    if (result.success) {
      res.json({ received: true, orderId: result.orderId ?? null });
    } else {
      res.status(400).json({ received: false });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error';
    console.error('Stripe webhook error:', message);
    res.status(500).json({ error: message });
  }
});

/** POST /api/webhooks/swish — Swish callback
 *  Swish sends: { reference, status, amount, ... } */
router.post('/swish', async (req: Request, res: Response) => {
  try {
    const data = req.body as { reference: string; status: string; amount?: number };
    if (!data.reference || !data.status) {
      res.status(400).json({ error: 'Missing reference or status' });
      return;
    }

    const result = await handleSwishCallback(data);

    if (result.success) {
      res.json({ received: true, orderId: result.orderId ?? null });
    } else {
      res.status(400).json({ received: false });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Swish callback error';
    console.error('Swish callback error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
