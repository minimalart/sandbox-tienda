'use client'

// GENERADO por packages/project-composer (renderRecommendationCartSlots).
// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.
import type { HttpTypes } from '@medusajs/types';
import {
  RecommendationsCartSlot as PluginCartRecommendations,
  FreeShippingBridgeSlot as PluginFreeShippingBridge,
} from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import FeaturedProductCard from '@modules/home/components/featured-product-card';

export function CartRecommendations(props: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
}) {
  return <PluginCartRecommendations {...props} CardComponent={FeaturedProductCard} />;
}

export function FreeShippingBridge(props: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null;
}) {
  return <PluginFreeShippingBridge {...props} CardComponent={FeaturedProductCard} />;
}
