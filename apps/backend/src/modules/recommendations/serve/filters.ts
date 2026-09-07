import type {
  DiscardReason,
  EligibilityContext,
  FilterOutcome,
  HydratedProduct,
  HydratedVariant,
  PlacementFilters,
  ScoredCandidate,
} from '../types';

/**
 * Filtros de elegibilidad, aplicados AL SERVIR (PRD §8).
 *
 * Es la pieza central del diseño: las relaciones y los scores se precalculan, pero
 * stock, canal, precio por región y contenido del carrito cambian a cada segundo,
 * así que se evalúan acá sobre un set de candidatos ya acotado. Por eso el motor
 * lee muchos más candidatos que el límite pedido.
 *
 * Función PURA: recibe todo lo que necesita por parámetro y no toca base ni
 * container. Todo el criterio de negocio que decide si un producto se muestra vive
 * acá y se testea sin levantar Medusa.
 */

/**
 * Stock disponible de una variante.
 *
 * `manage_inventory === false` significa stock ilimitado (servicios, digitales,
 * productos sin control de inventario), no cero. Mismo criterio que
 * `api/store/shop-by-look/route.ts`.
 */
export const stockOf = (variant: HydratedVariant): number =>
  variant.manage_inventory === false ? Number.POSITIVE_INFINITY : variant.available;

/** ¿Tiene alguna variante comprable (con stock y con precio para la región)? */
const purchasableVariants = (product: HydratedProduct): HydratedVariant[] =>
  product.variants.filter((v) => stockOf(v) > 0);

const hasPrice = (variant: HydratedVariant): boolean =>
  typeof variant.calculated_amount === 'number' && Number.isFinite(variant.calculated_amount);

/**
 * Precio de referencia del producto: el más bajo entre las variantes comprables.
 *
 * Se usa para el filtro de rango y para la banda de los bridge products. El mínimo
 * y no el de la variante por defecto: si alguna variante entra en el rango pedido,
 * el producto es elegible.
 */
export const referencePrice = (product: HydratedProduct): number | null => {
  const amounts = purchasableVariants(product)
    .filter(hasPrice)
    .map((v) => v.calculated_amount as number);
  if (!amounts.length) return null;
  return Math.min(...amounts);
};

const asSet = (values: string[] | undefined): Set<string> => new Set(values ?? []);

const intersects = (a: Iterable<string>, b: ReadonlySet<string>): boolean => {
  for (const value of a) if (b.has(value)) return true;
  return false;
};

/**
 * Aplica los filtros obligatorios y los configurables, en ese orden, y devuelve
 * los candidatos que sobreviven junto con el conteo de descartes por razón.
 *
 * El orden importa: primero lo estructural (existe, tiene variantes, hay stock),
 * después lo contextual (canal, precio, carrito) y al final lo configurable. Así
 * el desglose de descartes señala la causa raíz y no un síntoma — un producto sin
 * stock se reporta como `out_of_stock`, no como `price_range` por no tener precio.
 */
export function applyEligibilityFilters(
  candidates: Array<{ candidate: ScoredCandidate['candidate']; product: HydratedProduct | undefined }>,
  ctx: EligibilityContext,
  filters: PlacementFilters = {},
): FilterOutcome {
  const kept: ScoredCandidate[] = [];
  const discarded: Partial<Record<DiscardReason, number>> = {};
  const seen = new Set<string>();

  const drop = (reason: DiscardReason) => {
    discarded[reason] = (discarded[reason] ?? 0) + 1;
  };

  const sourceCategories = asSet(ctx.source_product?.category_ids);
  const sourceBrand = ctx.source_product?.brand_id ?? null;
  const excludedCategories = asSet(filters.excluded_category_ids);
  const requiredTags = asSet(filters.required_tags);
  const excludedTags = asSet(filters.excluded_tags);

  for (const { candidate, product } of candidates) {
    const productId = candidate.target_product_id;

    // Un mismo producto puede venir por dos relaciones distintas (dos tipos, dos
    // estrategias). Se queda la primera, que por el orden del ranking es la mejor.
    if (seen.has(productId)) {
      drop('duplicate');
      continue;
    }

    // --- Filtros obligatorios -------------------------------------------------

    // Nunca recomendar el producto que se está mirando.
    if (ctx.source_product_id && productId === ctx.source_product_id) {
      drop('source_product');
      continue;
    }
    if (ctx.exclude_product_ids.has(productId)) {
      drop('excluded');
      continue;
    }
    // Ausente del batch de hidratación = borrado o no publicado (el query.graph
    // filtra `status: 'published'`).
    if (!product) {
      drop('not_hydrated');
      continue;
    }
    if (!product.variants.length) {
      drop('no_variants');
      continue;
    }

    const inStock = purchasableVariants(product);
    if (!inStock.length) {
      drop('out_of_stock');
      continue;
    }

    // Canal de venta. Se filtra acá y no en el query.graph para no depender del
    // soporte de filtros sobre links. Sin canal en el request no se filtra: es
    // preferible recomendar de más que devolver vacío por un parámetro faltante.
    if (ctx.sales_channel_id && !product.sales_channel_ids.includes(ctx.sales_channel_id)) {
      drop('sales_channel');
      continue;
    }

    // Sin precio calculado para la región/moneda del request el producto no es
    // comprable en este contexto, aunque exista y tenga stock.
    const price = referencePrice(product);
    if (price === null) {
      drop('no_price');
      continue;
    }

    if (ctx.cart_product_ids.has(productId)) {
      drop('in_cart');
      continue;
    }

    // --- Filtros configurables ------------------------------------------------

    if (typeof filters.price_min === 'number' && price < filters.price_min) {
      drop('price_range');
      continue;
    }
    if (typeof filters.price_max === 'number' && price > filters.price_max) {
      drop('price_range');
      continue;
    }

    // `same_category` / `different_category` sólo aplican si conocemos las
    // categorías del origen; sin origen (trending, popular, bridge) se ignoran.
    if (filters.same_category && sourceCategories.size) {
      if (!intersects(product.category_ids, sourceCategories)) {
        drop('same_category');
        continue;
      }
    }
    if (filters.different_category && sourceCategories.size) {
      if (intersects(product.category_ids, sourceCategories)) {
        drop('different_category');
        continue;
      }
    }
    if (filters.same_brand && sourceBrand) {
      if (product.brand_id !== sourceBrand) {
        drop('same_brand');
        continue;
      }
    }
    if (excludedCategories.size && intersects(product.category_ids, excludedCategories)) {
      drop('excluded_category');
      continue;
    }
    if (requiredTags.size && !intersects(product.tag_values, requiredTags)) {
      drop('required_tags');
      continue;
    }
    if (excludedTags.size && intersects(product.tag_values, excludedTags)) {
      drop('excluded_tags');
      continue;
    }
    if (filters.metadata_match && Object.keys(filters.metadata_match).length) {
      const metadata = product.metadata ?? {};
      const matches = Object.entries(filters.metadata_match).every(
        ([key, value]) => String(metadata[key] ?? '') === String(value ?? ''),
      );
      if (!matches) {
        drop('metadata_match');
        continue;
      }
    }

    seen.add(productId);
    kept.push({ candidate, product });
  }

  return { kept, discarded };
}
