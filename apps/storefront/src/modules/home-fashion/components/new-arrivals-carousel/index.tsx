import { getActiveTenant } from "@lib/site-config/active-tenant";
import { searchTypesenseProducts } from "@lib/typesense";
import type { FashionHomeConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ScrollCarousel from "@modules/common/components/scroll-carousel";
import FashionProductCard from "./fashion-product-card";

type ProductSource = keyof Pick<
  FashionHomeConfig,
  "newArrivals" | "featuredProducts"
>;

/**
 * Carrusel de productos del template Moda (reutilizable).
 *
 * Sirve tanto para "New Arrivals" como para "Productos destacados" (carrusel
 * secundario): cambia la clave de config (`source`) y el título. Consume el
 * filtro Typesense estándar para que el contenido sea dinámico por
 * demo / vertical / sales channel. Si el backend falla, la sección se oculta.
 */
export default async function NewArrivalsCarousel({
  source = "newArrivals",
  viewAllHref = "/store",
}: {
  source?: ProductSource;
  viewAllHref?: string;
}) {
  const tenant = await getActiveTenant();
  const config = tenant.assets.fashion?.[source];
  if (!config?.filter) return null;

  const filter = config.filter;
  const title = config.title ?? "New Arrivals";
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
      `[NewArrivalsCarousel] "${source}" fetch failed, hiding section:`,
      err,
    );
    return null;
  }

  if (!products.length) return null;

  const header = (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="f-section-title">{title}</h2>
        {description && <p className="f-section-subtitle">{description}</p>}
      </div>
      <LocalizedClientLink
        href={viewAllHref}
        className="f-cta hidden whitespace-nowrap sm:inline-flex"
      >
        Ver todo
      </LocalizedClientLink>
    </div>
  );

  return (
    <section className="fashion-home bg-[--f-canvas] py-14 sm:py-20">
      <div className="mx-auto max-w-[1600px] overflow-x-hidden px-4 sm:px-6 lg:px-10">
        <ScrollCarousel
          disableScrollForFew
          title={header}
          headerClassName="mb-8"
          containerClassName="gap-4 pb-2 sm:gap-5"
          snap
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[58%] flex-shrink-0 snap-start sm:w-[260px]"
            >
              <FashionProductCard product={product} />
            </div>
          ))}
        </ScrollCarousel>
      </div>
    </section>
  );
}
