import type { CampaignKitsSectionConfig } from "@lib/site-config/types";
import { searchTypesenseProducts } from "@lib/typesense";
import CampaignKitsList from "./kits-list.client";

/**
 * Feed de kits/productos del template Campaña. Server component: hace el fetch
 * inicial y le pasa la primera página al client `CampaignKitsList` que arma
 * el layout con `InfiniteScrollSentinel`.
 *
 * A diferencia del PLP de otros templates NO tiene facetas ni filtros
 * visibles: es un feed lineal de conversión directa. La card es la canónica
 * de Mercatto (`TypesenseProductCard variant="home"`), la misma que usa el
 * catálogo de supermercado — así hereda wishlist, stepper, quick-view, badge
 * de descuento sin duplicar componentes. En stock primero. Si Typesense falla,
 * se oculta en silencio.
 */
export default async function CampaignKits({
  config,
  countryCode,
}: {
  config: CampaignKitsSectionConfig;
  countryCode: string;
}) {
  const filter = config.filter ?? {};
  const pageSize = filter.limit ?? 8;
  let initialProducts: Awaited<
    ReturnType<typeof searchTypesenseProducts>
  >["products"] = [];
  let initialHasMore = false;
  try {
    const result = await searchTypesenseProducts({
      page: 1,
      limit: pageSize,
      collectionId: filter.collectionId,
      tag: filter.tag,
      sortBy: "created_at",
    });
    initialProducts = result.products;
    initialHasMore = result.totalPages > 1;
  } catch (err) {
    console.error("[CampaignKits] fetch inicial failed, hiding section:", err);
    return null;
  }
  initialProducts.sort((a, b) => {
    const aIn = a.stock_available > 0;
    const bIn = b.stock_available > 0;
    if (aIn === bIn) return 0;
    return aIn ? -1 : 1;
  });
  if (!initialProducts.length) return null;

  return (
    <section
      id="tienda"
      className="campaign-home bg-white text-[color:var(--campaign-card-fg,#0f1114)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {config.title}
          </h2>
          {config.subtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600">
              {config.subtitle}
            </p>
          ) : null}
        </header>
        <CampaignKitsList
          initialProducts={initialProducts}
          initialHasMore={initialHasMore}
          pageSize={pageSize}
          countryCode={countryCode}
          filters={{
            collectionId: filter.collectionId,
            tag: filter.tag,
          }}
        />
      </div>
    </section>
  );
}
