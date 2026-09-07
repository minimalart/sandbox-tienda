import { getActiveTenant } from "@lib/site-config/active-tenant";
import { searchTypesenseProducts } from "@lib/typesense";
import ScrollCarousel from "@modules/common/components/scroll-carousel";
import SportsProductCard from "./sports-product-card";

/**
 * Productos destacados del template Marca Deportiva.
 *
 * Consume el filtro Typesense de `assets.sports.featuredProducts` (mismo
 * contrato dinámico que el resto del storefront) y los muestra en un carrusel
 * horizontal con cards minimalistas. Si el backend falla, la sección se oculta
 * en silencio (no tumba la home).
 */
type SportsFilter = {
  limit?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "created_at";
  categoryId?: string;
  collectionId?: string;
  productIds?: string[];
  searchQuery?: string;
  tag?: string;
};

type SportsFeaturedProductsProps = {
  /** Override del título; si no, usa el de la config. */
  title?: string;
  description?: string;
  /** Override del filtro Typesense; si no, usa `assets.sports.featuredProducts`. */
  filter?: SportsFilter;
};

/**
 * Una fila de productos del template deportivo. Por defecto consume el bloque
 * `assets.sports.featuredProducts`, pero acepta props para renderizar VARIAS
 * filas distintas (novedades, tendencia, recomendados) intercaladas con los
 * banners de la home.
 */
export default async function SportsFeaturedProducts({
  title: titleProp,
  description: descriptionProp,
  filter: filterProp,
}: SportsFeaturedProductsProps = {}) {
  const tenant = await getActiveTenant();
  const config = tenant.assets.sports?.featuredProducts;
  const filter = filterProp ?? config?.filter;
  if (!filter) return null;

  const title = titleProp ?? config?.title ?? "Lo más nuevo";
  const description = descriptionProp ?? config?.description;

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
    console.error("[SportsFeaturedProducts] fetch failed, hiding section:", err);
    return null;
  }

  if (!products.length) return null;

  const header = (
    <div className="flex-1">
      <h2 className="sp-section-title">{title}</h2>
      {description && <p className="sp-section-subtitle">{description}</p>}
    </div>
  );

  return (
    <section className="sports-home bg-[--sp-paper] py-12 sm:py-16">
      <div className="mx-auto max-w-[1600px] overflow-x-hidden px-4 sm:px-6 lg:px-10">
        <ScrollCarousel
          disableScrollForFew
          title={header}
          headerClassName="mb-7 flex items-end gap-4"
          arrowClassName="hidden h-10 w-10 items-center justify-center border border-[--sp-ink] bg-[--sp-ink] text-[--sp-on-dark] transition hover:opacity-80 sm:flex"
          containerClassName="gap-4 pb-2 sm:gap-5"
          snap
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="w-[58%] flex-shrink-0 snap-start sm:w-[260px]"
            >
              <SportsProductCard product={product} />
            </div>
          ))}
        </ScrollCarousel>
      </div>
    </section>
  );
}
