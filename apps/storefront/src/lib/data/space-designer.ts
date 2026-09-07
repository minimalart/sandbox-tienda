import 'server-only';
import { cache } from 'react';
import { getMedusaSDK } from '@lib/config';
import { getActiveSalesChannelId, getAuthHeaders, getCartId } from '@lib/data/cookies';
import { getRegion } from '@lib/data/regions';
import type { SpaceConfigurator, SpacePublicConfigurator } from '@lib/space-designer/types';

const unavailable = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  if (status !== 404)
    console.error('[space-designer] No se pudo cargar el diseñador:', (error as Error)?.message);
};

export const getSpaceConfigurators = cache(async (): Promise<SpaceConfigurator[]> => {
  try {
    const [sdk, salesChannelId, headers] = await Promise.all([
      getMedusaSDK(),
      getActiveSalesChannelId(),
      getAuthHeaders(),
    ]);
    const configurators: SpaceConfigurator[] = [];
    let count = 0;
    do {
      const response = await sdk.client.fetch<{
        configurators: SpaceConfigurator[];
        count: number;
      }>('/store/space-designer/configurators', {
        method: 'GET',
        headers,
        query: {
          ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
          limit: 100,
          offset: configurators.length,
        },
        cache: 'no-store',
      });
      const page = response.configurators ?? [];
      configurators.push(...page);
      count = response.count ?? configurators.length;
      if (page.length === 0) break;
    } while (configurators.length < count);
    return configurators;
  } catch (error) {
    unavailable(error);
    return [];
  }
});

export const getSpaceConfigurator = cache(
  async (slug: string, countryCode: string): Promise<SpacePublicConfigurator | null> => {
    try {
      const [sdk, salesChannelId, region, cartId, headers] = await Promise.all([
        getMedusaSDK(),
        getActiveSalesChannelId(),
        getRegion(countryCode),
        getCartId(),
        getAuthHeaders(),
      ]);
      const { configurator } = await sdk.client.fetch<{ configurator: SpacePublicConfigurator }>(
        `/store/space-designer/configurators/${encodeURIComponent(slug)}`,
        {
          method: 'GET',
          headers,
          query: {
            ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
            ...(region?.id ? { region_id: region.id } : {}),
            ...(cartId ? { cart_id: cartId } : {}),
          },
          cache: 'no-store',
        }
      );
      return configurator ?? null;
    } catch (error) {
      unavailable(error);
      return null;
    }
  }
);
