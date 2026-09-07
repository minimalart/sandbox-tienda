'use server';

import 'server-only';

import {
	HOME_BANNER_PLACEMENTS,
	normalizeApiBanner,
	sortBannersByPriority,
	type ApiBanner,
	type RawApiBanner,
} from '@lib/banners';
import { getTenant } from '@lib/site-config/resolver';
import { getActiveDemoSalesChannelId } from '@lib/site-config/active-tenant';
import { getAdminSDK } from '@lib/config';
import { retrieveCustomer } from '@lib/data/customer';
import { cache } from 'react';

type BannerQueryOptions = {
	country?: string;
	customerGroupId?: string;
	customerGroupIds?: string[];
	device?: string;
	locale?: string;
	path?: string;
	salesChannelId?: string;
	/** Scoping estricto por canal (contexto demo): excluye banners globales. */
	requireSalesChannel?: boolean;
};

type BannerResponse = {
	banners?: RawApiBanner[];
};

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

function buildBannerSearchParams(placements: string[], options: BannerQueryOptions = {}) {
	const params = new URLSearchParams();

	for (const placement of placements) {
		params.append('placement', placement);
	}

	if (options.country) {
		params.set('country', options.country);
	}

	if (options.customerGroupId) {
		params.append('customer_group_id', options.customerGroupId);
	}

	// A customer can belong to several groups — append each so a banner targeted
	// to ANY of them matches (the backend treats repeated params as an OR list).
	for (const groupId of options.customerGroupIds ?? []) {
		params.append('customer_group_id', groupId);
	}

	if (options.device) {
		params.set('device', options.device);
	}

	if (options.locale) {
		params.set('locale', options.locale);
	}

	if (options.path) {
		params.set('path', options.path);
	}

	if (options.salesChannelId) {
		params.set('sales_channel_id', options.salesChannelId);
	}

	if (options.requireSalesChannel) {
		params.set('require_sales_channel', '1');
	}

	return params;
}

export async function getBanners(placements: string[], options: BannerQueryOptions = {}): Promise<ApiBanner[]> {
	if (!placements.length) {
		return [];
	}

	try {
		const params = buildBannerSearchParams(placements, options);
		const response = await fetch(`${BACKEND_URL}/store/banners?${params.toString()}`, {
			headers: {
				'Content-Type': 'application/json',
				...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
			},
			next: { revalidate: 20 },
		});

		if (!response.ok) {
			console.debug('[Banners] Endpoint not available:', response.status);
			return [];
		}

		const data = (await response.json()) as BannerResponse;
		const normalized = (data.banners ?? []).map(normalizeApiBanner);
		const sortedBanners = sortBannersByPriority(normalized);

		return sortedBanners;
	} catch (error) {
		console.debug('[Banners] Could not fetch banners:', error);
		return [];
	}
}

/**
 * Resolves the logged-in customer's customer-group ids so banners can be
 * targeted by audience. Customer groups are admin-managed data, so we read them
 * through the admin API (same pattern as the guest-customer sync). Returns an
 * empty array for anonymous visitors or when no admin key is configured — in
 * that case only banners with no group restriction are shown.
 */
export const getCurrentCustomerGroupIds = cache(async (): Promise<string[]> => {
	if (!process.env.MEDUSA_ADMIN_API_KEY) {
		return [];
	}
	try {
		const customer = await retrieveCustomer();
		if (!customer?.id) {
			return [];
		}
		const adminSdk = getAdminSDK();
		const { customer: full } = await adminSdk.admin.customer.retrieve(
			customer.id,
			{ fields: 'id,groups.id' },
		);
		const groups =
			(full as { groups?: Array<{ id?: string }> } | null)?.groups ?? [];
		return groups
			.map((group) => group.id)
			.filter((id): id is string => Boolean(id));
	} catch {
		return [];
	}
});

export const getHomeBanners = cache(async (): Promise<ApiBanner[]> => {
	const tenant = await getTenant();
	const customerGroupIds = await getCurrentCustomerGroupIds();

	return getBanners([...HOME_BANNER_PLACEMENTS], {
		salesChannelId: tenant.medusa.salesChannelId,
		customerGroupIds,
	});
});

/**
 * Home banners para una demo: estrictamente scopeados al sales channel de la
 * demo (solo banners explícitamente asignados a ese canal). Sin canal de demo
 * (no estamos en /demo/{slug}) devuelve []. La home del demo así solo muestra
 * sus propios banners y oculta el hero si no tiene ninguno.
 */
export const getDemoHomeBanners = cache(async (): Promise<ApiBanner[]> => {
	const salesChannelId = await getActiveDemoSalesChannelId();
	if (!salesChannelId) return [];
	const customerGroupIds = await getCurrentCustomerGroupIds();
	return getBanners([...HOME_BANNER_PLACEMENTS], {
		salesChannelId,
		customerGroupIds,
		requireSalesChannel: true,
	});
});

export type ApiBannerData = ApiBanner;
