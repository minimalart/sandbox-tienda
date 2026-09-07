import { getProductsByIds, listProducts } from "@lib/data/products";
import { getRegion } from "@lib/data/regions";
import {
  RecommendationRail,
  getEngineRecommendations,
} from "@lib/recommendations-slot";
import { isProductInStock } from "@lib/util/is-product-in-stock";
import { searchTypesenseProducts } from "@lib/typesense";
import type { HttpTypes } from "@medusajs/types";
import ScrollCarousel from "@modules/common/components/scroll-carousel";
import FeaturedProductCard from "@modules/home/components/featured-product-card";

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct;
  countryCode: string;
};

/**
 * "También te podría interesar" al final del PDP.
 *
 * Con la extensión `recommendation-widgets` instalada, este rail lo sirve el MOTOR
 * (placement `product-detail-similar`): mismo título, misma posición, pero ranking
 * calculado por atributos del catálogo, filtros de stock y canal aplicados al servir, y
 * tracking del embudo.
 *
 * Sin la extensión, cae a la heurística original —colección + tags, ordenando los
 * productos con stock primero— que es lo que mantiene compilable y funcional un proyecto
 * generado que no compró la extensión. Ese fallback NO es código muerto: es el
 * comportamiento por defecto del boilerplate.
 *
 * El slot `@lib/recommendations-slot` lo genera el composer. No importar
 * `@modules/recommendations/...` directo desde acá.
 */
export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode);

  if (!region) {
    return null;
  }

  // --- Camino del motor -----------------------------------------------------

  const recommendation = await getEngineRecommendations({
    placement: "product-detail-similar",
    product_id: product.id,
    country_code: countryCode,
  });

  if (recommendation?.products.length) {
    const products = await getProductsByIds({
      productIds: recommendation.products.map((item) => item.product_id),
      countryCode,
    });

    if (products.length) {
      return (
        <RecommendationRail
          headingId="related-heading"
          products={products}
          region={region}
          requestId={recommendation.request_id}
          title="También te podría interesar"
        />
      );
    }
  }

  // --- Fallback sin la extensión (o sin resultados del motor) ----------------

  const queryParams: any = {};
  if (region?.id) {
    queryParams.region_id = region.id;
  }
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id];
  }
  if (product.tags) {
    queryParams.tag_id = product.tags
      .map((t) => t.id)
      .filter(Boolean) as string[];
  }
  queryParams.is_giftcard = false;

  const products = await listProducts({
    queryParams,
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

  // Fetch Typesense data for discount information
  const productIds = items.map((p) => p.id);
  let typesenseProductsMap = new Map<string, any>();

  try {
    const { products: typesenseProducts } = await searchTypesenseProducts({
      productIds,
      limit: 12,
    });

    typesenseProducts.forEach((tp) => {
      typesenseProductsMap.set(tp.id, tp);
    });
  } catch (error) {
    console.error("[RelatedProducts] Error fetching Typesense data:", error);
  }

  // Merge Typesense discount data with Medusa products
  const itemsWithDiscount = items.map((item) => {
    const typesenseData = typesenseProductsMap.get(item.id);
    if (typesenseData) {
      return {
        ...item,
        discount: typesenseData.discount,
        subtotal: typesenseData.subtotal,
        price: typesenseData.price,
        promotions: typesenseData.promotions,
      };
    }
    return item;
  });

  return (
    <>
      <ScrollCarousel
        disableScrollForFew
        wrapperClassName="mt-6"
        title={
          <h2 className="font-bold text-gray-900 text-xl" id="related-heading">
            También te podría interesar
          </h2>
        }
      >
        {itemsWithDiscount.map((relatedProduct) => (
          <div className="w-[216px] flex-shrink-0" key={relatedProduct.id}>
            <FeaturedProductCard product={relatedProduct} region={region} />
          </div>
        ))}
      </ScrollCarousel>
    </>
  );
}
