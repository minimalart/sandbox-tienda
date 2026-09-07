import { getActiveTenant } from "@lib/site-config/active-tenant";
import { searchTypesenseProducts } from "@lib/typesense";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ScrollCarousel from "@modules/common/components/scroll-carousel";
import { ArrowRight } from "lucide-react";
import TechProductCard from "./tech-product-card";

/**
 * Productos destacados del template Tecnología.
 *
 * Consume el filtro Typesense de `assets.technology.featuredProducts` (mismo
 * contrato dinámico que el resto del storefront) y los muestra en un carrusel
 * horizontal con cards tecnológicas. Si el backend falla, la sección se oculta
 * en silencio (no tumba la home).
 */
export default async function TechFeaturedProducts({
  countryCode,
}: {
  countryCode: string;
}) {
  const tenant = await getActiveTenant();
  const config = tenant.assets.technology?.featuredProducts;
  if (!config?.filter) return null;

  const filter = config.filter;
  const title = config.title ?? "Productos destacados";
  const description = config.description;

  let products: Awaited<
    ReturnType<typeof searchTypesenseProducts>
  >["products"] = [];
  try {
    const result = await searchTypesenseProducts({
      limit: filter.limit || 12,
      sortBy: filter.sortBy,
      categoryId: filter.categoryId,
      collectionId: filter.collectionId,
      productIds: filter.productIds,
      q: filter.searchQuery,
      tag: filter.tag,
    });
    products = result.products;
  } catch (err) {
    console.error(
      "[TechFeaturedProducts] fetch failed, hiding section:",
      err,
    );
    return null;
  }

  // En stock primero.
  products.sort((a, b) => {
    const aIn = a.stock_available > 0;
    const bIn = b.stock_available > 0;
    if (aIn === bIn) return 0;
    return aIn ? -1 : 1;
  });

  if (!products.length) return null;

  const header = (
    <div>
      <h2 className="tech-section-title">{title}</h2>
      {description && <p className="tech-section-subtitle">{description}</p>}
    </div>
  );

  return (
    <section className="tech-home bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-[1440px] overflow-x-hidden px-4 sm:px-6 lg:px-8">
        <ScrollCarousel
          disableScrollForFew
          title={header}
          headerClassName="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          containerClassName="gap-4 pb-6"
          snap
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[260px] flex-shrink-0 snap-start"
            >
              <TechProductCard product={product} countryCode={countryCode} />
            </div>
          ))}
        </ScrollCarousel>

        <div className="mt-2">
          <LocalizedClientLink
            href="/store"
            className="inline-flex items-center gap-2 text-[15px] font-medium text-[--tech-blue] hover:underline"
          >
            Ver todo el catálogo <ArrowRight className="size-4" />
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  );
}
