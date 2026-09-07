import type { HttpTypes } from "@medusajs/types";

function variantHasOptionValue(
  variant: HttpTypes.StoreProductVariant,
  needle: string,
): boolean {
  if (!variant.options) return false;
  const target = needle.toLowerCase();
  return variant.options.some((opt) =>
    (opt.value?.toLowerCase() || "").includes(target),
  );
}

function isBulkVariant(variant: HttpTypes.StoreProductVariant): boolean {
  return variantHasOptionValue(variant, "bulto");
}

/**
 * REGLA B2C: siempre usar la variante "Individual", nunca la de "Bulto".
 * Detecta por `variant.options[].value` (case-insensitive).
 */
export function getIndividualVariant(
  variants: HttpTypes.StoreProductVariant[] | undefined | null,
): HttpTypes.StoreProductVariant | undefined {
  if (!variants || variants.length === 0) return undefined;
  if (variants.length === 1) return variants[0];

  const individual = variants.find((v) => variantHasOptionValue(v, "individual"));
  if (individual) return individual;

  const nonBulk = variants.find((v) => !isBulkVariant(v));
  return nonBulk;
}

export function isIndividualVariant(
  variant: HttpTypes.StoreProductVariant,
): boolean {
  if (isBulkVariant(variant)) return false;
  return true;
}
