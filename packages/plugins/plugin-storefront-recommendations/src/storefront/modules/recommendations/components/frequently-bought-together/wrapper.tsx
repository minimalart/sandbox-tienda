import type { HttpTypes } from '@medusajs/types';
import FrequentlyBoughtTogether from '.';
import type { RecommendationRequest, RecommendationResponse } from '../../types';

/**
 * Mitad de SERVIDOR de "Comprados juntos": pide al motor e hidrata precios.
 *
 * El motor devuelve una proyección liviana, pero el bloque necesita variantes y precios
 * completos de Medusa para calcular el total y agregar al carrito. Se hidrata con
 * `getProductsByIds`, que ya pide `*variants.calculated_price` y conserva el orden.
 *
 * El precio que se muestra es SIEMPRE el que devuelve Medusa: esta extensión no tiene
 * motor de promociones propio ni inventa un "ahorro por combo" (PRD §9.2).
 *
 * Este componente vive en el plugin pero recibe los fetchers server-side por prop
 * porque son host-coupled (usan `sdk`/`cookies`/`getRegion` que sólo el host puede
 * componer). El shim del storefront (PR-C) los inyecta.
 */
export default async function FrequentlyBoughtTogetherWrapper({
  product,
  countryCode,
  getRecommendations,
  getProductsByIds,
}: {
  product: HttpTypes.StoreProduct;
  countryCode: string;
  /** Server fetcher inyectado por el host: `getRecommendations` con SDK/cookies bindeados. */
  getRecommendations: (request: RecommendationRequest) => Promise<RecommendationResponse>;
  /** Server fetcher inyectado por el host: hidrata productos con variantes y precios. */
  getProductsByIds: (input: {
    productIds: string[];
    countryCode: string;
  }) => Promise<HttpTypes.StoreProduct[]>;
}) {
  const response = await getRecommendations({
    placement: 'product-detail-fbt',
    product_id: product.id,
    country_code: countryCode,
  });

  if (!response.products.length) return null;

  const companions = await getProductsByIds({
    productIds: response.products.map((item) => item.product_id),
    countryCode,
  });

  // Un bloque de "comprados juntos" con una sola fila no es un combo: es el producto
  // que ya se está mirando. Mejor no mostrar nada.
  if (companions.length < 1) return null;

  return (
    <FrequentlyBoughtTogether
      anchor={product}
      companions={companions}
      requestId={response.request_id}
      countryCode={countryCode}
    />
  );
}
