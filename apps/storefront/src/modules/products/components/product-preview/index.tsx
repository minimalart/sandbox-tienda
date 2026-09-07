import { listChannelProducts } from "@lib/data/channel-products";
import { getProductPrice } from "@lib/util/get-product-price";
import type { HttpTypes } from "@medusajs/types";
import ProductPreviewClient from "./client";

export default async function ProductPreview({
  product,
  region,
}: {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
}) {
  // Extraer el código de país del primer país en la región
  const countryCode = region.countries?.[0]?.iso_2 || "ar";

  const queryParams: any = { id: [product.id!] };
  const pricedProduct = await listChannelProducts({
    countryCode,
    queryParams,
    includeSpecialPricing: true,
  }).then(({ response }) => response.products[0]);

  const { cheapestPrice } = getProductPrice({
    product: pricedProduct,
  });

  return (
    <ProductPreviewClient
      price={cheapestPrice}
      pricedProduct={pricedProduct}
      product={product}
      region={region}
    />
  );
}
