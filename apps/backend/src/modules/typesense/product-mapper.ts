import { classifyProduct, getAdvisorRules } from './advisor';

type AnyRecord = Record<string, any>;

/**
 * Build hierarchical category levels for Typesense indexing.
 * Converts Medusa category tree into lvl0, lvl1, lvl2 facet fields.
 */
function buildCategoryLevels(category: AnyRecord): {
  categories_lvl0: string[];
  categories_lvl1: string[];
  categories_lvl2: string[];
  category_path_ids: string[];
  category_id: string | null;
  category_path_label: string;
} {
  const names: string[] = [];
  const ids: string[] = [];

  const fullPath: Array<{ id: string; name: string }> | null | undefined = category?._full_path;

  if (Array.isArray(fullPath) && fullPath.length > 0) {
    for (const entry of fullPath) {
      names.push(entry.name);
      ids.push(entry.id);
    }
  } else {
    let current: AnyRecord | null = category;
    while (current) {
      names.unshift(current.name as string);
      ids.unshift(current.id as string);
      current = (current.parent_category as AnyRecord | null) ?? null;
    }
  }

  const lvl0 = names[0] ? [names[0]] : [];
  const lvl1 = names[1] ? [`${names[0]} > ${names[1]}`] : [];
  const lvl2 = names[2] ? [`${names[0]} > ${names[1]} > ${names[2]}`] : [];

  return {
    categories_lvl0: lvl0,
    categories_lvl1: lvl1,
    categories_lvl2: lvl2,
    category_path_ids: ids,
    category_id: ids[ids.length - 1] ?? null,
    category_path_label: names.join(' > '),
  };
}

export class ProductMapper {
  static toTypesenseObject(product: AnyRecord): object {
    let categoryHierarchy = {
      categories_lvl0: [] as string[],
      categories_lvl1: [] as string[],
      categories_lvl2: [] as string[],
      category_path_ids: [] as string[],
      category_id: null as string | null,
      category_path_label: '',
    };

    if (Array.isArray(product?.categories) && product.categories.length > 0) {
      const primaryCategory = product.categories[0] as AnyRecord;
      categoryHierarchy = buildCategoryLevels(primaryCategory);

      if (product.categories.length > 1) {
        const allLevels = (product.categories as AnyRecord[]).map((cat) =>
          buildCategoryLevels(cat)
        );
        categoryHierarchy.categories_lvl0 = Array.from(
          new Set(allLevels.flatMap((l) => l.categories_lvl0))
        );
        categoryHierarchy.categories_lvl1 = Array.from(
          new Set(allLevels.flatMap((l) => l.categories_lvl1))
        );
        categoryHierarchy.categories_lvl2 = Array.from(
          new Set(allLevels.flatMap((l) => l.categories_lvl2))
        );
        categoryHierarchy.category_path_ids = Array.from(
          new Set(allLevels.flatMap((l) => l.category_path_ids))
        );
      }
    }

    const variants = Array.isArray(product?.variants) ? (product.variants as AnyRecord[]) : [];

    // A variant that doesn't manage inventory (or allows backorder) is always
    // purchasable — index it as effectively unlimited so storefront stock
    // checks and in-stock-first sorting behave correctly.
    const hasUnmanagedVariant = variants.some(
      (v: AnyRecord) => v.manage_inventory === false || v.allow_backorder === true
    );

    const managedStock = variants.reduce((acc: number, variant: AnyRecord) => {
      const items = Array.isArray(variant.inventory_items)
        ? (variant.inventory_items as AnyRecord[])
        : [];
      return (
        acc +
        items.reduce((iacc: number, item: AnyRecord) => {
          const levels = Array.isArray(item.inventory?.location_levels)
            ? (item.inventory.location_levels as AnyRecord[])
            : [];
          return iacc + levels.reduce((lacc: number, lvl: AnyRecord) => lacc + ((lvl.available_quantity as number) || 0), 0);
        }, 0)
      );
    }, 0);

    const stockAvailable = hasUnmanagedVariant ? 999999 : managedStock;

    // Price for the index (sorting + the storefront's price:>0 filter). Prefer
    // the calculated_price (region/currency aware), but FALL BACK to the
    // variant's raw price when it doesn't resolve. The sync computes
    // calculated_price for a single currency (the first region's), so a catalog
    // priced in another currency — e.g. a demo store in a non-default region —
    // would otherwise index price 0 and disappear from the storefront. The raw
    // price keeps those products visible. (No effect on the main catalog, where
    // calculated_price always resolves.)
    const firstVariant = variants[0] as AnyRecord | undefined;
    const calcAmount = firstVariant?.calculated_price?.calculated_amount;
    const rawPrices = Array.isArray(firstVariant?.prices)
      ? (firstVariant?.prices as AnyRecord[])
      : [];
    const rawAmount = rawPrices[0]?.amount;
    const firstVariantPrice =
      calcAmount != null
        ? Number(calcAmount) || 0
        : rawAmount != null
          ? Number(rawAmount) || 0
          : 0;

    // Promotions — populated by the typesense-sync script, which resolves which
    // products each active promotion targets and attaches a compact object here.
    // `application_method` (type/value) is what lets the storefront tell a
    // percentage from a fixed promo and render the right badge; campaign.name is
    // the facet/filter for the "Promociones" section. Ver schema.ts + sync.
    const promotions =
      Array.isArray(product?.promotions) && product.promotions.length > 0
        ? (product.promotions as AnyRecord[]).map((promo: AnyRecord) => ({
            id: promo.id as string,
            code: (promo.code as string) ?? '',
            type: (promo.type as string) ?? '',
            status: promo.status as string | undefined,
            is_automatic: promo.is_automatic as boolean | undefined,
            campaign: promo.campaign
              ? {
                  id: (promo.campaign as AnyRecord).id as string,
                  name: (promo.campaign as AnyRecord).name as string,
                  description: (promo.campaign as AnyRecord).description as string | undefined,
                }
              : undefined,
            application_method: promo.application_method
              ? {
                  type: (promo.application_method as AnyRecord).type as string | undefined,
                  value: (promo.application_method as AnyRecord).value as number | undefined,
                  target_type: (promo.application_method as AnyRecord).target_type as
                    | string
                    | undefined,
                  allocation: (promo.application_method as AnyRecord).allocation as
                    | string
                    | undefined,
                }
              : undefined,
          }))
        : [];

    return {
      id: product.id as string,
      title: (product.title as string) ?? '',
      subtitle: (product.subtitle as string) ?? '',
      handle: (product.handle as string) ?? '',
      description: (product.description as string) ?? '',
      status: product.status as string,
      is_giftcard: (product.is_giftcard as boolean) ?? false,
      thumbnail: (product.thumbnail as string | null) ?? null,
      price: firstVariantPrice,
      price_currency:
        (firstVariant?.calculated_price?.currency_code as string | undefined) ??
        (rawPrices[0]?.currency_code as string | undefined) ??
        undefined,
      // discount/subtotal are computed by the sync (from active automatic promos)
      // and passed through here; fall back to "no discount" when absent.
      discount: typeof product.discount === 'number' ? (product.discount as number) : 0,
      subtotal: Number.isFinite(product.subtotal as number)
        ? (product.subtotal as number)
        : firstVariantPrice,
      has_promotion: promotions.length > 0,
      promotions,
      created_at: (() => {
        const t = new Date(product.created_at as string).getTime();
        return Number.isFinite(t) ? t : 0;
      })(),
      categories:
        Array.isArray(product?.categories) && product.categories.length > 0
          ? (product.categories as AnyRecord[]).map((category: AnyRecord) => ({
              id: category.id as string,
              name: category.name as string,
              handle: category.handle as string,
              is_active: category.is_active as boolean,
              is_internal: category.is_internal as boolean,
              parent_category: category.parent_category as AnyRecord | undefined,
            }))
          : [],
      'categories.lvl0': categoryHierarchy.categories_lvl0,
      'categories.lvl1': categoryHierarchy.categories_lvl1,
      'categories.lvl2': categoryHierarchy.categories_lvl2,
      category_id: categoryHierarchy.category_id,
      category_path_ids: categoryHierarchy.category_path_ids,
      category_path_label: categoryHierarchy.category_path_label,
      collection: product.collection
        ? {
            id: (product.collection as AnyRecord).id as string,
            title: (product.collection as AnyRecord).title as string,
            handle: (product.collection as AnyRecord).handle as string,
          }
        : undefined,
      type: product.type
        ? {
            id: (product.type as AnyRecord).id as string,
            value: (product.type as AnyRecord).value as string,
          }
        : undefined,
      // Brand from metadata.brand (string) — Medusa has no native brand entity
      brand:
        typeof product.metadata?.brand === 'string' && product.metadata.brand.length > 0
          ? {
              id: (product.metadata.brand as string).toLowerCase().replace(/\s+/g, '-'),
              name: product.metadata.brand as string,
            }
          : undefined,
      // Family from metadata.family (string) — the ERP's free-text family, which
      // cuts across categories. Same shape as brand so the storefront can reuse
      // the facet/filter path (`family.name`).
      // `zeus_familia` is the legacy key written by the demo-store importer on
      // catalogs that were loaded before the ERP sync existed; reading it as a
      // fallback avoids rewriting the metadata of thousands of products (and the
      // per-product reindex storm that would trigger).
      family: (() => {
        const raw = product.metadata?.family ?? product.metadata?.zeus_familia;
        return typeof raw === 'string' && raw.length > 0
          ? { id: raw.toLowerCase().replace(/\s+/g, '-'), name: raw }
          : undefined;
      })(),
      tags:
        Array.isArray(product?.tags) && product.tags.length > 0
          ? (product.tags as AnyRecord[]).map((tag: AnyRecord) => ({
              id: tag.id as string,
              value: tag.value as string,
            }))
          : [],
      variants: variants.map((variant: AnyRecord) => ({
        ...(variant.metadata?.catalog_commercial ? { metadata: { catalog_commercial: variant.metadata.catalog_commercial } } : {}),
        id: variant.id as string,
        title: variant.title as string,
        sku: variant.sku as string | null,
        ean: variant.ean as string | null,
        barcode: variant.barcode as string | null,
        inventory_quantity: (variant.inventory_quantity as number) ?? 0,
        allow_backorder: (variant.allow_backorder as boolean) ?? false,
        manage_inventory: (variant.manage_inventory as boolean) ?? true,
        variant_rank: (variant.variant_rank as number) ?? 0,
        calculated_price: variant.calculated_price
          ? {
              calculated_amount: variant.calculated_price.calculated_amount as number | null,
              original_amount: variant.calculated_price.original_amount as number | null,
              currency_code: variant.calculated_price.currency_code as string | null,
            }
          : undefined,
        // Channel-scoped overrides — se popula solo si el enrich vía
        // `attachChannelPrices` encontró entries para esta variante. Ausente
        // por default (backward-compat con docs viejos).
        ...(Array.isArray(variant.channel_prices) && variant.channel_prices.length > 0
          ? {
              channel_prices: (variant.channel_prices as AnyRecord[]).map((cp) => ({
                sales_channel_id: cp.sales_channel_id as string,
                calculated_amount: cp.calculated_amount as number,
                original_amount: cp.original_amount as number,
                currency_code: cp.currency_code as string,
              })),
            }
          : {}),
      })),
      stock_available: stockAvailable,
      options:
        Array.isArray(product?.options) && product.options.length > 0
          ? (product.options as AnyRecord[]).map((option: AnyRecord) => ({
              id: option.id as string,
              title: option.title as string,
              values: (option.values as AnyRecord[]).map((v: AnyRecord) => v.value as string),
            }))
          : [],
      images:
        Array.isArray(product?.images) && product.images.length > 0
          ? (product.images as AnyRecord[]).map((image: AnyRecord) => ({
              id: image.id as string,
              url: image.url as string,
            }))
          : [],
      sales_channels:
        Array.isArray(product?.sales_channels) && product.sales_channels.length > 0
          ? (product.sales_channels as AnyRecord[]).map((channel: AnyRecord) => ({
              id: channel.id as string,
              name: channel.name as string,
            }))
          : [],
      // Canales donde este producto no se vende suelto. Siempre presente (vacío
      // incluido) para que el documento no dependa de que alguien haya
      // configurado algo — ver `bundle-only-channels.ts`.
      bundle_only_channels: Array.isArray(product?.bundle_only_channels)
        ? (product.bundle_only_channels as string[])
        : [],
      metadata: {
        ...((product.metadata as AnyRecord | null) ?? {}),
        // Always present — the storefront filters on it (see schema note)
        hidden_from_store: (product.metadata as AnyRecord | null)?.hidden_from_store === true,
      },
      // Asesor guiado: 5 dimensiones derivadas de categorías/familia/título según
      // las reglas activas del proceso (`loadAdvisorRules`). Sin reglas cargadas
      // el spread no agrega nada y el documento queda igual que antes.
      ...(classifyProduct(product, getAdvisorRules()) ?? {}),
    };
  }
}
