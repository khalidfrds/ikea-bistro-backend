/**
 * server/src/data/menu.ts — Server-side menu source of truth
 * Phase: PH3-ENHANCED
 * Source: Constitution Article 3 + Domain Contract v3.0 §2.1
 *
 * Important: the server is the source of truth for pricing.
 * Phase 3: categoryId added for smart upsell co-occurrence tracking.
 */

export interface ServerMenuItem {
	/** Matches the client MenuItem.id */
	id: string;
	name: string;
	price: number;
	categoryId: string;
}

export const serverMenuItems: ServerMenuItem[] = [
	// Nytt
	{ id: 'choklad_glass', name: 'Mjukglass med chokladtomte', price: 12, categoryId: 'nytt' },

	// Varm mat
	{ id: 'hotdog_classic', name: 'Kokt varmkorv', price: 5, categoryId: 'varm_mat' },
	{ id: 'veggie_dog', name: 'Veggie hotdog', price: 5, categoryId: 'varm_mat' },
	{ id: 'grilled_sausage', name: 'Grillad wienerkorv i bröd', price: 12, categoryId: 'varm_mat' },
	{ id: 'pizza', name: 'Surdegspizza', price: 12, categoryId: 'varm_mat' },

	// Toppings
	{ id: 'onion', name: 'Rostad lök', price: 2, categoryId: 'toppings' },
	{ id: 'cabbage', name: 'Picklad rödkål', price: 3, categoryId: 'toppings' },

	// Fika/Glass
	{ id: 'icecream_basic', name: 'Mjukglass', price: 7, categoryId: 'fika_glass' },
	{ id: 'coffee', name: 'Kaffe', price: 9, categoryId: 'fika_glass' },
	{ id: 'kanelbulle', name: 'Kanelbulle', price: 5, categoryId: 'fika_glass' },

	// Kall dryck
	{ id: 'fountain_drink', name: 'Dryck i mugg', price: 10, categoryId: 'kall_dryck' },
	{ id: 'iskub_cola', name: 'ISKUB Cola', price: 19, categoryId: 'kall_dryck' },
	{ id: 'iskub_orange', name: 'ISKUB Apelsin', price: 19, categoryId: 'kall_dryck' },
];

export const serverMenuById: Record<string, ServerMenuItem> = Object.fromEntries(
	serverMenuItems.map((i) => [i.id, i])
);
