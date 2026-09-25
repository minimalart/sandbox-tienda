'use client'

// GENERADO por packages/project-composer (renderRecommendationCartSlots).
// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.
// FOLLOW-UP: si `CartRail` del plugin renderiza el header cuando el resultado
// viene vacío (sin productos recomendados), ese estado empty vive del lado del
// plugin (`@minimalart/mercatto-plugin-storefront-recommendations`), fuera de
// este monorepo. Un "no mostrar el bloque si no hay recomendaciones" hay que
// fixearlo en el plugin y publicar una versión nueva; NO parchear node_modules
// desde acá. Fuera del scope de este PR.
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
