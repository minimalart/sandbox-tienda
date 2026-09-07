'use server';

import 'server-only';

import { cache } from 'react';
import { getActiveDemoSalesChannelId } from '@lib/site-config/active-tenant';
import { getActiveSalesChannelId } from '@lib/data/cookies';

type RawApiBrand = {
	id: string;
	name: string;
	handle: string;
	description?: string | null;
	is_active?: boolean;
	metadata?: Record<string, unknown> | null;
	// `/store/brands` ahora devuelve las imágenes inline (una sola query en el
	// backend). Es opcional para tolerar backends viejos: si falta, caemos al
	// fetch por marca de abajo.
	images?: RawBrandImage[];
};

type RawBrandImage = {
	id: string;
	url: string;
	file_id: string;
	type: 'thumbnail' | 'image';
	brand_id: string;
};

export type StoreBrand = {
	id: string;
	name: string;
	handle: string;
	image: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

const HEADERS = {
	'Content-Type': 'application/json',
	...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
};

async function fetchBrandImages(brandId: string): Promise<RawBrandImage[]> {
	try {
		const response = await fetch(`${BACKEND_URL}/store/brands/${brandId}/images`, {
			headers: HEADERS,
			next: { revalidate: 60 },
		});

		if (!response.ok) {
			return [];
		}

		const data = (await response.json()) as { images?: RawBrandImage[] };

		return data.images ?? [];
	} catch (error) {
		console.debug('[Brands] Could not fetch brand images:', error);
		return [];
	}
}

/**
 * Fetches active brands from the brands extension and resolves a display
 * image for each one (thumbnail preferred). Brands without images are
 * excluded — the home "Nuestras marcas" section only renders brands that
 * have a logo to show.
 */
export const getStoreBrands = cache(async (): Promise<StoreBrand[]> => {
	try {
		// Scopeamos por el canal activo (misma regla que el blog): en el store
		// principal oculta las marcas de otras demos y muestra las globales; en una
		// demo (strict) muestra solo las suyas, ocultando las globales.
		const demoSalesChannelId = await getActiveDemoSalesChannelId();
		const salesChannelId = await getActiveSalesChannelId();
		const params = new URLSearchParams();
		if (salesChannelId) {
			params.set('sales_channel_id', salesChannelId);
			if (demoSalesChannelId) params.set('strict', '1');
		}
		const qs = params.toString() ? `?${params}` : '';
		const response = await fetch(`${BACKEND_URL}/store/brands${qs}`, {
			headers: HEADERS,
			next: { revalidate: 60 },
		});

		if (!response.ok) {
			console.debug('[Brands] Endpoint not available:', response.status);
			return [];
		}

		const data = (await response.json()) as { brands?: RawApiBrand[] };
		const brands = data.brands ?? [];

		const withImages = await Promise.all(
			brands.map(async (brand) => {
				// Backend nuevo: imágenes inline (sin request extra). Backend viejo
				// (campo ausente): fallback al fetch por marca. Un array vacío es una
				// respuesta válida (marca sin logo) y NO dispara el fallback.
				const images = brand.images ?? (await fetchBrandImages(brand.id));
				const image = images.find((img) => img.type === 'thumbnail')?.url ?? images[0]?.url;

				if (!image) {
					return null;
				}

				return {
					id: brand.id,
					name: brand.name,
					handle: brand.handle,
					image,
				} satisfies StoreBrand;
			}),
		);

		return withImages.filter((brand): brand is StoreBrand => brand !== null);
	} catch (error) {
		console.debug('[Brands] Could not fetch brands:', error);
		return [];
	}
});
