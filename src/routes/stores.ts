/**
 * server/src/routes/stores.ts — IKEA store list API
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §4.7
 * GET /api/stores — list all stores
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { getStores, haversineDistanceKm } from '../services/storeService.js';

const router = Router();

/** GET /api/stores — returns all IKEA stores with optional distance */
router.get('/', (req: Request, res: Response) => {
  try {
    const stores = getStores();

    const latStr = req.query['lat'] as string | undefined;
    const lonStr = req.query['lon'] as string | undefined;

    if (latStr && lonStr) {
      const userLat = parseFloat(latStr);
      const userLon = parseFloat(lonStr);

      if (!isNaN(userLat) && !isNaN(userLon)) {
        const withDistance = stores
          .map((s) => ({
            ...s,
            distanceKm: haversineDistanceKm(userLat, userLon, s.latitude, s.longitude),
          }))
          .sort((a, b) => a.distanceKm - b.distanceKm);

        res.json({ stores: withDistance });
        return;
      }
    }

    res.json({ stores });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('GET /api/stores error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
