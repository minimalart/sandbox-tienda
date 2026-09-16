import 'server-only';

import { cache } from 'react';
import { getActiveDemoSalesChannelId } from '@lib/site-config/active-tenant';
import { getActiveSalesChannelId } from './cookies';

/**
 * El id del tipo de sucursal. Ya no es un enum: cada tienda define su lista en
 * `content_config.sucursales.types`. Cadena vacía = sin tipo.
 */
export type StoreLocationType = string;

export type BusinessHoursSlot = {
	open: string;
	close: string;
};

export type BusinessHoursEntry = {
	closed: boolean;
	is24Hours: boolean;
	slots: BusinessHoursSlot[];
};

export type BusinessHours = Record<string, BusinessHoursEntry>;

export type PublicStoreLocation = {
	id: string;
	name: string;
	street: string;
	city: string;
	province: string;
	lat: string | null;
	lng: string | null;
	store_type: StoreLocationType;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	business_hours: BusinessHours | null;
	images: string[] | null;
	social: {
		instagram: string | null;
		facebook: string | null;
		website: string | null;
		tiktok: string | null;
		linkedin: string | null;
	} | null;
};

type StoreLocationsResponse = {
	store_locations?: PublicStoreLocation[];
};

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

/**
 * El canal de venta activo con el que scopear las sucursales. En el store
 * principal es el canal por defecto (o el de la sucursal); en una demo es el
 * canal de la demo y activamos `strict` para NO mostrar las sucursales globales
 * del store principal. Con `strict` en falso, las sucursales sin canal
 * (globales) siguen siendo visibles. Mismo patrón que el blog.
 */
async function activeChannelScope(): Promise<{ channelId?: string; strict: boolean }> {
	const demoChannelId = await getActiveDemoSalesChannelId();
	const channelId = await getActiveSalesChannelId();
	return { channelId: channelId || undefined, strict: Boolean(demoChannelId) };
}

/**
 * Fetches the public (visible) store locations from the backend, scoped to the
 * active sales channel. Returns an empty array on any error so the page always
 * renders.
 *
 * The channel is resolved INSIDE the cache()d body (zero-arg signature, like
 * blog.ts): `cache()` memoizes per render pass and the channel comes from that
 * same request, while Next's data cache keys on the URL — so `revalidate: 60`
 * stays correct per channel.
 */
export const getStoreLocations = cache(async (): Promise<PublicStoreLocation[]> => {
	try {
		const qs = new URLSearchParams();
		const scope = await activeChannelScope();
		if (scope.channelId) {
			qs.set('sales_channel_id', scope.channelId);
			if (scope.strict) qs.set('strict', '1');
		}
		const query = qs.toString();
		const response = await fetch(`${BACKEND_URL}/store/store-locations${query ? `?${query}` : ''}`, {
			headers: {
				'Content-Type': 'application/json',
				...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
			},
			next: { revalidate: 60 },
		});

		if (!response.ok) {
			console.debug('[StoreLocations] Endpoint not available:', response.status);
			return [];
		}

		const data = (await response.json()) as StoreLocationsResponse;
		return data.store_locations ?? [];
	} catch (error) {
		console.debug('[StoreLocations] Could not fetch store locations:', error);
		return [];
	}
});
