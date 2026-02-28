/**
 * server/src/data/stores.ts — IKEA Sweden store seed data
 * Phase: PH3-ENHANCED
 * Source: Task Card AGENT 07 PH3 (seed data section)
 */

import type { Store } from '../types.js';

export const seedStoreData: Store[] = [
  {
    id: 'store-kungens-kurva',
    name: 'IKEA Kungens Kurva',
    city: 'Stockholm',
    latitude: 59.2753,
    longitude: 17.9295,
  },
  {
    id: 'store-barkarby',
    name: 'IKEA Barkarby',
    city: 'Stockholm',
    latitude: 59.4054,
    longitude: 17.8469,
  },
  {
    id: 'store-malmo',
    name: 'IKEA Malmö',
    city: 'Malmö',
    latitude: 55.5710,
    longitude: 13.0003,
  },
  {
    id: 'store-goteborg',
    name: 'IKEA Göteborg',
    city: 'Göteborg',
    latitude: 57.7239,
    longitude: 12.0160,
  },
  {
    id: 'store-linkoping',
    name: 'IKEA Linköping',
    city: 'Linköping',
    latitude: 58.3880,
    longitude: 15.6710,
  },
];
