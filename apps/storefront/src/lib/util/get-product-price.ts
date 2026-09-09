import type { HttpTypes } from "@medusajs/types";
import { getIndividualVariant } from "@lib/util/get-individual-variant";
import { getPercentageDiff } from "./get-precentage-diff";
import { convertToLocale } from "@lib/util/money";
import { catalogListAmount } from './catalog-commercial';

export const getPricesForVariant = (variant: any) => {
  if (!variant?.calculated_price?.calculated_amount) {
    return null;
  }

  const reference = catalogListAmount(variant);
  const originalAmount = Math.max(variant.calculated_price.original_amount ?? variant.calculated_price.calculated_amount, reference ?? 0);
  return {
    calculated_price_number: variant.calculated_price.calculated_amount,
    calculated_price: convertToLocale({
      amount: variant.calculated_price.calculated_amount,
      currency_code: variant.calculated_price.currency_code,
    }),
    original_price_number: originalAmount,
    original_price: convertToLocale({
      amount: originalAmount,
      currency_code: variant.calculated_price.currency_code,
    }),
    currency_code: variant.calculated_price.currency_code,
    price_type: reference ? 'sale' : variant.calculated_price.calculated_price?.price_list_type,
    percentage_diff: getPercentageDiff(
      originalAmount,
      variant.calculated_price.calculated_amount
    ),
  };
};

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct;
  variantId?: string;
}) {
  if (!(product && product.id)) {
    throw new Error("No product provided");
  }

  const cheapestPrice = () => {
    if (!(product && product.variants?.length)) {
      return null;
    }

    // REGLA B2C: usar la variante Individual antes que la más barata.
    const individualVariant = getIndividualVariant(product.variants);
    if (individualVariant?.calculated_price) {
      return getPricesForVariant(individualVariant);
    }

    let cheapestVariant: any = null;
    let cheapestAmount = Number.POSITIVE_INFINITY;
    for (const variant of product.variants as any[]) {
      const amount = variant.calculated_price?.calculated_amount;
      if (amount == null) continue;
      if (amount < cheapestAmount) {
        cheapestAmount = amount;
        cheapestVariant = variant;
      }
    }

    return cheapestVariant ? getPricesForVariant(cheapestVariant) : null;
  };

  const variantPrice = () => {
    if (!(product && variantId)) {
      return null;
    }

    const variant: any = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    );

    if (!variant) {
      return null;
    }

    return getPricesForVariant(variant);
  };

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  };
}
