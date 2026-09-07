import { getProductsByIds, listProducts } from "@lib/data/products";
import { getRegion } from "@lib/data/regions";
import {
  RecommendationRail,
  getEngineRecommendations,
} from "@lib/recommendations-slot";
import { isProductInStock } from "@lib/util/is-product-in-stock";
import type { HttpTypes } from "@medusajs/types";
import FeaturedProductCard from "@modules/home/components/featured-product-card";
import ScrollCarousel from "@modules/common/components/scroll-carousel";

type SameCategoryProductsProps = {
  product: HttpTypes.StoreProduct;
  countryCode: string;
};

/**
 * Rail de mitad de página del PDP.
 *
 * Con la extensión `recommendation-widgets` sirve los COMPLEMENTARIOS del motor
 * (placement `product-detail-complementary`): relaciones cargadas a mano por el
 * merchant, con fallback a co-compra y populares. El título pasa a "Combina bien con"
 * porque el contenido cambió de verdad — seguir diciendo "Más de {subcategoría}" sobre
 * productos de otra categoría sería mentirle al usuario.
 *
 * Se usa el placement de complementarios y NO el de similares para no duplicar
 * `RelatedProducts`, que ya sirve los similares al final de la página. Así el PDP queda
 * con un rail por placement y sin productos repetidos.
 *
 * Sin la extensión cae a la lógica original (más productos de la subcategoría más
 * profunda). Ese fallback es el comportamiento por defecto del boilerplate, no código
 * muerto: el composer borra la extensión de los proyectos que no la seleccionan.
 */
export default async function SameCategoryProducts({
  product,
  countryCode,
}: SameCategoryProductsProps) {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  // --- Camino del motor -----------------------------------------------------

  const recommendation = await getEngineRecommendations({
    placement: "product-detail-complementary",
    product_id: product.id,
    country_code: countryCode,
  });

  if (recommendation?.products.length) {
    const engineProducts = await getProductsByIds({
      productIds: recommendation.products.map((item) => item.product_id),
      countryCode,
    });

    if (engineProducts.length) {
      return (
        <section className="mt-12">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <RecommendationRail
              headingId="complementary-heading"
              products={engineProducts}
              region={region}
              requestId={recommendation.request_id}
              title="Combina bien con"
            />
          </div>
        </section>
      );
    }
  }

  // --- Fallback sin la extensión (o sin resultados del motor) ----------------

  // Get the deepest subcategory (last in the array)
  const categories = product.categories ?? [];
  const subcategory = categories.at(-1);

  if (!subcategory?.id) {
    return null;
  }

  const queryParams: Record<string, unknown> = {
    region_id: region.id,
    category_id: [subcategory.id],
    is_giftcard: false,
    limit: 12,
  };

  const products = await listProducts({
    queryParams: queryParams as HttpTypes.FindParams &
      HttpTypes.StoreProductParams,
    countryCode,
  }).then(({ response }) =>
    response.products.filter(
      (responseProduct) => responseProduct.id !== product.id,
    ),
  );

  if (!products.length) {
    return null;
  }

  const items = products.slice(0, 12).sort((a, b) => {
    const aIn = isProductInStock(a);
    const bIn = isProductInStock(b);
    if (aIn === bIn) return 0;
    return aIn ? -1 : 1;
  });

  return (
    <section className="mt-12">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <ScrollCarousel
          disableScrollForFew
          title={
            <h2 className="font-bold text-gray-900 text-xl">
              Más de {subcategory.name}
            </h2>
          }
        >
          {items.map((p) => (
            <div className="w-[216px] flex-shrink-0" key={p.id}>
              <FeaturedProductCard product={p} region={region} />
            </div>
          ))}
        </ScrollCarousel>
      </div>
    </section>
  );
}
