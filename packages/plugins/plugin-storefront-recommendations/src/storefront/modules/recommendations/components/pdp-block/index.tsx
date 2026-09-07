import type { HttpTypes } from '@medusajs/types';
import { Suspense, type ComponentType } from 'react';
import FrequentlyBoughtTogetherWrapper from '../frequently-bought-together/wrapper';
import RecentlyViewed from '../recently-viewed';
import RecentlyViewedRecorder from '../recently-viewed/recorder';
import type { RecommendationRequest, RecommendationResponse } from '../../types';

/**
 * Bloque nuevo de recomendaciones del PDP: comprados juntos y vistos recientemente.
 *
 * Sólo estos dos, a propósito. Los otros dos placements del PRD §9.1 los sirven los
 * rails que YA existían en el PDP, ahora alimentados por el motor y conservando su
 * lugar en la página:
 *
 *   - similares      → `RelatedProducts` ("También te podría interesar", al final)
 *   - complementarios → `SameCategoryProducts` (a mitad de página)
 *
 * Agregarlos también acá daría dos rails con los mismos productos, que es peor que lo
 * que había antes. Total en el PDP: cuatro rails, uno por placement, sin solapamiento.
 *
 * Cada rail va en su propio `<Suspense>` para que streameen independientes: si el
 * cálculo de comprados-juntos tarda, el resto de la página ya se está viendo.
 *
 * Este componente es de SERVIDOR y por eso recibe los fetchers server-side por prop:
 * `getRecommendations` y `getProductsByIds` los compone el host con SDK/cookies/region
 * bindeados (esos ports NO son accesibles desde un server component vía hooks).
 */
export default function RecommendationsPdpBlock({
  product,
  region,
  countryCode,
  getRecommendations,
  getProductsByIds,
  CardComponent,
}: {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
  countryCode: string;
  getRecommendations: (request: RecommendationRequest) => Promise<RecommendationResponse>;
  getProductsByIds: (input: {
    productIds: string[];
    countryCode: string;
  }) => Promise<HttpTypes.StoreProduct[]>;
  CardComponent: ComponentType<{
    product: HttpTypes.StoreProduct;
    region: HttpTypes.StoreRegion;
  }>;
}) {
  return (
    <>
      {/* Registra la visita para el rail de vistos recientemente. No renderiza nada. */}
      <RecentlyViewedRecorder productId={product.id} handle={product.handle} />

      <section aria-labelledby="fbt-heading" className="mt-10">
        <Suspense fallback={null}>
          <FrequentlyBoughtTogetherWrapper
            product={product}
            countryCode={countryCode}
            getRecommendations={getRecommendations}
            getProductsByIds={getProductsByIds}
          />
        </Suspense>
      </section>

      <section aria-labelledby="recently-viewed-heading" className="mt-6">
        <RecentlyViewed
          region={region}
          countryCode={countryCode}
          currentProductId={product.id}
          CardComponent={CardComponent}
        />
      </section>
    </>
  );
}
