// GENERADO por packages/project-composer (renderRecommendationSlots).
// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.
import 'server-only';
import type { HttpTypes } from '@medusajs/types';
import {
  createGetRecommendations,
  RecommendationsPdpSlot as PluginPdpSlot,
  RecommendationCarousel as PluginCarousel,
  type RecommendationRequest,
  type RecommendationResponse,
} from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import { sdk } from '@lib/config';
import { getActiveSalesChannelId, getAuthHeaders, getCartId } from '@lib/data/cookies';
import { getProductsByIds } from '@lib/data/products';
import { getRegion } from '@lib/data/regions';
import FeaturedProductCard from '@modules/home/components/featured-product-card';

export const recommendationWidgetsAvailable = true;

const boundGetRecommendations = createGetRecommendations({
  sdk: sdk as unknown as Parameters<typeof createGetRecommendations>[0]['sdk'],
  cookies: {
    getCartId: async () => (await getCartId()) ?? null,
    getActiveSalesChannelId: async () => (await getActiveSalesChannelId()) ?? null,
    getAuthHeaders: async () => {
      const headers = await getAuthHeaders();
      return (headers ?? {}) as Record<string, string>;
    },
  },
  getRegion: async (countryCode: string) => (await getRegion(countryCode)) ?? null,
});

export const getEngineRecommendations = async (
  request: RecommendationRequest,
): Promise<RecommendationResponse | null> => boundGetRecommendations(request);

const bindGetProductsByIds =
  (countryCode: string) =>
  async (input: { productIds: string[]; countryCode?: string }): Promise<HttpTypes.StoreProduct[]> =>
    getProductsByIds({
      productIds: input.productIds,
      countryCode: input.countryCode ?? countryCode,
    });

export function RecommendationRail(props: {
  requestId: string | null;
  title: string;
  products: HttpTypes.StoreProduct[];
  region: HttpTypes.StoreRegion;
  headingId?: string;
}) {
  return <PluginCarousel {...props} CardComponent={FeaturedProductCard} />;
}

export function RecommendationsPdpSlot(props: {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
  countryCode: string;
}) {
  return (
    <PluginPdpSlot
      {...props}
      getRecommendations={boundGetRecommendations}
      getProductsByIds={bindGetProductsByIds(props.countryCode)}
      CardComponent={FeaturedProductCard}
    />
  );
}
