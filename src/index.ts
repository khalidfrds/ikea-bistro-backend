/**
 * server/src/index.ts — Express server entry point
 * Phase: PH3-ENHANCED
 * Port: 3000 (configurable via PORT env)
 * CORS: localhost:5173 (frontend dev server)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import webhooksRouter from './routes/webhooks.js';
import storesRouter from './routes/stores.js';
import favoritesRouter from './routes/favorites.js';
import userRouter from './routes/user.js';
import upsellRouter from './routes/upsell.js';

/** Initialize SQLite schema + seed stores on startup */
import { seedStores } from './store/database.js';
import { seedStoreData } from './data/stores.js';

seedStores(seedStoreData);
console.log('SQLite database initialized and stores seeded.');

const app = express();
const PORT = parseInt(process.env['PORT'] || '3000', 10);
const FRONTEND_URL = process.env['FRONTEND_URL'] || 'http://localhost:5173';

/** CORS — allow frontend origin */
app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
  })
);

/**
 * Body parsing:
 * - Stripe webhook needs raw body for signature verification
 * - All other routes use JSON
 */
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

/** Routes */
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/stores', storesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/user', userRouter);
app.use('/api/upsell', upsellRouter);

/** Health check */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', phase: 'PH3-ENHANCED', timestamp: new Date().toISOString() });
});

/** Start server */
app.listen(PORT, () => {
  console.log(`IKEA Bistro TMA Server running on http://localhost:${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Phase: PH3-ENHANCED`);
});
