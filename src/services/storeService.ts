/**
 * server/src/services/storeService.ts — Store queries
 * Phase: PH3-ENHANCED
 * Source: Domain Contract v3.0 §1.10, §4.7
 */

import { getAllStores, getStoreById } from '../store/database.js';
import type { Store } from '../types.js';

/** 4.7 Get all stores */
export function getStores(): Store[] {
  return getAllStores();
}

/** Get store by ID — returns undefined if not found */
export function getStore(storeId: string): Store | undefined {
  return getStoreById(storeId);
}

/** Haversine distance formula — returns distance in km */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
