import type { CampaignKitsSectionConfig } from "@lib/site-config/types";
import { searchTypesenseProducts } from "@lib/typesense";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { BundleCard } from "@modules/bundles/components/bundle-card";
import { loadBundleCards } from "@modules/bundles/lib/load-bundle-cards";
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
  withBundles = false,
}: {
  config: CampaignKitsSectionConfig;
  countryCode: string;
  /**
   * Los kits publicados de la tienda abren el feed, con la card del índice
   * `/bundles` (PRD Bundles V2 §40). Es lo que distingue un kit de un producto
   * a simple vista: la card tonal sin foto contra la card de producto con foto.
   */
  withBundles?: boolean;
}) {
  const filter = config.filter ?? {};
  const pageSize = filter.limit ?? 4;
  // En paralelo con la búsqueda: los kits no le suman latencia al feed.
  const kitsPromise = withBundles
    ? Promise.all([loadBundleCards(), getActiveTenant()])
    : Promise.resolve(null);
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
  const loaded = await kitsPromise;
  const kits = loaded?.[0] ?? [];
  const primaryColor = loaded?.[1].theme?.colors?.primary;
  if (!initialProducts.length && !kits.length) return null;

  const kitCards = kits.map((kit) => (
    <li key={kit.id} className="min-w-0">
      <BundleCard
        handle={kit.handle}
        title={kit.title}
        itemCount={kit.itemCount}
        configurableCount={kit.configurableCount}
        fromAmount={kit.fromAmount}
        currencyCode={kit.currencyCode}
        primaryColor={primaryColor}
        index={kit.index}
        className="h-full"
      />
    </li>
  ));

  return (
    <section
      id="tienda"
      className="campaign-home bg-[#f3f5f6] text-[color:var(--campaign-card-fg,#0f1114)]"
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
          leading={kitCards}
          filters={{
            collectionId: filter.collectionId,
            tag: filter.tag,
          }}
        />
      </div>
    </section>
  );
}
