import type {
  StorefrontBundleProduct,
  StorefrontVariant,
} from "@lib/data/bundles";

/**
 * Resolve a variant given a product + a partial option selection. Follows
 * PRD §13: only combinations that map to an existing (buyable) variant are
 * considered valid; the caller uses this to disable option values that don't
 * lead to any purchasable variant.
 */
export const findVariantByOptions = (
  product: StorefrontBundleProduct,
  optionValues: Record<string, string | null>,
): StorefrontVariant | null => {
  const optionTitles = product.options.map((o) => o.title);
  return (
    product.variants.find((variant) =>
      optionTitles.every((title) => {
        const wanted = optionValues[title];
        if (!wanted) return false;
        return variant.options[title] === wanted;
      }),
    ) ?? null
  );
};

export const isVariantBuyable = (variant: StorefrontVariant): boolean =>
  variant.inventory_available &&
  (!!variant.calculated_price || variant.allow_backorder || !variant.manage_inventory);

/**
 * For a given (partial) option selection, list which values remain valid for
 * a given option — i.e. would still map to at least one buyable variant if
 * chosen next. Used to disable/gray out impossible option chips.
 */
export const listAvailableValuesForOption = (
  product: StorefrontBundleProduct,
  currentSelection: Record<string, string | null>,
  optionTitle: string,
): Set<string> => {
  const available = new Set<string>();
  const otherTitles = product.options.map((o) => o.title).filter((t) => t !== optionTitle);
  for (const variant of product.variants) {
    if (!isVariantBuyable(variant)) continue;
    const matchesOthers = otherTitles.every((title) => {
      const chosen = currentSelection[title];
      if (!chosen) return true; // no constraint yet
      return variant.options[title] === chosen;
    });
    if (matchesOthers) {
      const value = variant.options[optionTitle];
      if (value) available.add(value);
    }
  }
  return available;
};

/**
 * Formato de precio del storefront. Medusa v2 guarda los montos en unidades
 * ENTERAS de la moneda (`calculated_amount: 7800` = $7.800), no en centavos:
 * dividir por 100 acá mostraba "$78" donde el resto del sitio muestra "$7.800".
 * Replica la salida de `convertToLocale` (`@lib/util/money`) — es-AR, estilo
 * decimal y símbolo antepuesto — en vez de importarlo: ese helper vive en el
 * paquete compartido y el resolver de `node --test` sólo mapea `@lib/*` dentro
 * de `src/`, así que importarlo dejaría este módulo sin tests.
 */
export const formatPrice = (
  amount: number | null | undefined,
  currency: string | null | undefined,
): string => {
  if (amount === null || amount === undefined || !currency) return "—";
  try {
    return `$ ${new Intl.NumberFormat("es-AR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(amount)}`;
  } catch {
    return `$ ${amount}`;
  }
};
