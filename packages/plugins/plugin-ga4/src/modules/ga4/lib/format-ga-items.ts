/**
 * Formatea líneas de carrito/orden al shape de `items` que espera GA4.
 * Portado verbatim del plugin @variablevic/google-analytics-medusa
 * (utils/format-ga-cart-items). item_id = variant_id, item_name = product_title,
 * item_category desde variant.product.categories.
 */
type LineItemLike = {
  variant_id?: string;
  product_title?: string;
  discount_total?: number;
  variant_title?: string;
  unit_price?: number;
  quantity?: number;
  variant?: { product?: { categories?: { name?: string }[] } };
};

type CartOrOrderLike = {
  sales_channel_id?: string;
};

export const formatGACartItems = (
  items: LineItemLike[] | undefined,
  cartOrOrder: CartOrOrderLike
): Record<string, unknown>[] | undefined => {
  return items?.map((item, index) => ({
    item_id: item.variant_id,
    item_name: item.product_title,
    affiliation: cartOrOrder.sales_channel_id,
    discount: item.discount_total,
    index,
    item_category: item.variant?.product?.categories?.map((c) => c.name).join(','),
    item_variant: item.variant_title,
    location_id: cartOrOrder.sales_channel_id,
    price: item.unit_price,
    quantity: item.quantity,
  }));
};
