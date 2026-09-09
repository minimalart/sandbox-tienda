import type {
  ImporterContext,
  ImportReport,
  NormalizedProduct,
  NormalizedVariant,
} from '../../../lib/catalog/types';
import { buildHandle, stripHtml } from '../../../lib/catalog/util';
import type { CatalogCommercial } from '../../../lib/catalog/commercial';
import type { ConnectionConfig } from '../config';
import { publicJson, SourceHttpError, type JsonTransport } from '../http';

function positive(raw: unknown): number | undefined {
  if (typeof raw !== 'number' && typeof raw !== 'string') return undefined;
  if (raw === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
function property(raw: any, item: any, name?: string): string | undefined {
  if (!name) return undefined;
  const direct = item[name] ?? raw[name];
  const field = [
    ...(Array.isArray(item.attributes) ? item.attributes : []),
    ...(Array.isArray(raw.properties) ? raw.properties : []),
  ].find((p: any) => p.name === name);
  const value = direct ?? field?.values ?? field?.value;
  return value === undefined
    ? undefined
    : String(Array.isArray(value) ? value[0] : value).slice(0, 200);
}

export function normalizeVtex(
  raw: any,
  config: Partial<ConnectionConfig>,
  now = new Date().toISOString()
): NormalizedProduct | null {
  const productId = String(raw.productId ?? '').trim();
  const title = String(raw.productName ?? '').trim();
  if (!productId || !title || !Array.isArray(raw.items)) return null;
  const variants: NormalizedVariant[] = [];
  const seen = new Set<string>();
  for (const item of raw.items) {
    const id = String(item.itemId ?? '').trim();
    if (!id || seen.has(id)) continue;
    const sellers = Array.isArray(item.sellers) ? item.sellers : [];
    const valid = (s: any) => positive(s.commertialOffer?.Price) !== undefined;
    const seller = config.sellerRef
      ? sellers.find((s: any) => String(s.sellerId) === config.sellerRef)
      : [...sellers]
          .sort(
            (a: any, b: any) =>
              Number(!!b.sellerDefault) - Number(!!a.sellerDefault) ||
              String(a.sellerId).localeCompare(String(b.sellerId))
          )
          .find(valid);
    if (!seller || !valid(seller)) continue;
    const offer = seller.commertialOffer;
    const sourceAmount = positive(offer.Price)!;
    const amount = Math.round(sourceAmount);
    if (amount <= 0) continue;
    const sourceListAmount = positive(offer.ListPrice);
    const listAmount = sourceListAmount === undefined ? undefined : Math.round(sourceListAmount);
    const warnings: string[] = [];
    if (offer.ListPrice != null && (listAmount === undefined || listAmount <= amount))
      warnings.push('El precio de lista no permite mostrar una referencia superior.');
    const rawPresentation = property(raw, item, config.fieldMapping?.unitsPerPackage);
    const mapped = positive(rawPresentation);
    const unitsPerPackage =
      config.presentation?.unitsPerPackage ?? (Number.isSafeInteger(mapped) ? mapped : undefined);
    const presentation = {
      ...config.presentation,
      label: config.presentation?.label ?? property(raw, item, config.fieldMapping?.label),
      unitsPerPackage,
      mode: config.presentation?.mode ?? ('informational' as const),
    };
    if (rawPresentation !== undefined && unitsPerPackage === undefined)
      warnings.push('Contenido por bulto inválido; se conserva como informativo.');
    if (
      presentation.mode === 'grouping' &&
      (!unitsPerPackage || presentation.priceBasis !== 'unit')
    ) {
      presentation.mode = 'informational';
      warnings.push('Falta confirmar equivalencia y precio por unidad.');
    }
    const observedQuantity = offer.AvailableQuantity;
    const quantity =
      typeof observedQuantity === 'number' &&
      Number.isFinite(observedQuantity) &&
      observedQuantity >= 0
        ? observedQuantity
        : undefined;
    const commercial: CatalogCommercial = {
      version: 1,
      priceTaxIncluded: config.priceTaxIncluded,
      currencyCode: config.currencyCode ?? '',
      amount,
      listAmount,
      sourceAmount,
      sourceListAmount,
      sellerRef: String(seller.sellerId ?? ''),
      contextRef: config.sourceChannel,
      observedAt: now,
      measurementUnit: typeof item.measurementUnit === 'string' ? item.measurementUnit : undefined,
      unitMultiplier: positive(item.unitMultiplier),
      presentation,
      purchasePolicy:
        presentation.mode === 'informational'
          ? { enabled: false }
          : (config.purchasePolicy ?? { enabled: false }),
      availability: {
        status: quantity === undefined ? 'unknown' : quantity > 0 ? 'available' : 'unavailable',
        quantity,
      },
      rawPresentation,
      mappingVersion: 'vtex-1',
      warnings,
    };
    // Include every external SKU, even if variation labels coincide.
    const dimensions = Array.isArray(item.variations)
      ? item.variations.map((d: any) => (typeof d === 'string' ? d : d.name)).filter(Boolean)
      : [];
    const label =
      dimensions
        .map((d: string) => property(raw, item, d))
        .filter(Boolean)
        .join(' / ') || String(item.name ?? item.nameComplete ?? id);
    variants.push({
      externalVariantId: id,
      sku: String(item.referenceId?.[0]?.Value ?? id),
      value: `${label} · ${id}`,
      ean: String(item.ean ?? '').replace(/\s+/g, ''),
      price: amount,
      listPrice: listAmount ?? amount,
      commercial,
    });
    seen.add(id);
  }
  if (!variants.length) return null;
  const first = variants[0]!;
  return {
    productId,
    title,
    slug: buildHandle(title, productId),
    ean: first.ean,
    description: stripHtml(String(raw.description ?? raw.metaTagDescription ?? '')),
    brand: raw.brand ? String(raw.brand).slice(0, 100) : null,
    categoryPath: String(raw.categories?.[0] ?? '')
      .split('/')
      .map((p) => p.trim())
      .filter(Boolean),
    price: first.price,
    listPrice: first.listPrice,
    images: [
      ...new Set<string>(
        raw.items
          .flatMap((i: any) => (i.images ?? []).map((image: any) => image.imageUrl))
          .filter((url: unknown) => typeof url === 'string' && url.startsWith('https://'))
      ),
    ].slice(0, 8),
    source: 'vtex',
    optionTitle: 'Presentación',
    variants,
  };
}

/** Bounded sequential pagination; no silent fallback for access or transient failures. */
export async function fetchVtexCatalog(
  ctx: ImporterContext,
  transport: JsonTransport = publicJson
): Promise<NormalizedProduct[]> {
  const config = (ctx.sourceConfig ?? {}) as Partial<ConnectionConfig>;
  const origin = new URL(ctx.sourceUrl).origin;
  let strategy = config.searchStrategy ?? 'auto';
  const pageSize = 50;
  const urlFor = (kind: string, page: number, count = pageSize) => {
    const url = new URL(
      kind === 'intelligent-search'
        ? config.sourceChannel
          ? '/api/intelligent-search/v1/product-search/'
          : '/api/io/_v/api/intelligent-search/product_search/'
        : '/api/catalog_system/pub/products/search',
      origin
    );
    if (kind === 'intelligent-search') {
      url.searchParams.set('page', String(page));
      url.searchParams.set('count', String(count));
      url.searchParams.set('sort', 'name:asc');
      url.searchParams.set('hideUnavailableItems', 'false');
    } else {
      url.searchParams.set('_from', String((page - 1) * pageSize));
      url.searchParams.set('_to', String((page - 1) * pageSize + count - 1));
    }
    if (config.sourceChannel) url.searchParams.set('sc', config.sourceChannel);
    return url.toString();
  };
  if (strategy === 'auto') {
    const probe = await transport(urlFor('intelligent-search', 1, 1));
    if (probe.status === 401 || probe.status === 403 || probe.status === 429 || probe.status >= 500)
      throw new SourceHttpError(probe.status);
    if (probe.status >= 200 && probe.status < 300 && Array.isArray(probe.body?.products))
      strategy = 'intelligent-search';
    else if ([404, 405].includes(probe.status) || (probe.status >= 200 && probe.status < 300))
      strategy = 'legacy';
    else throw new SourceHttpError(probe.status);
  }
  // The old Intelligent endpoint reads channel from a cookie. V1 accepts explicit sc.
  const report: ImportReport = {
    strategy:
      strategy === 'intelligent-search' && config.sourceChannel
        ? 'intelligent-search-v1'
        : strategy,
    complete: false,
    fetched: 0,
    excluded: 0,
    warnings: [],
  };
  const products = new Map<string, NormalizedProduct>();
  const pageIdentities = new Set<string>();
  const limit = ctx.targetCount ?? 50000;
  ctx.logger?.info(`Estrategia VTEX: ${strategy}.`);
  const maxPages = strategy === 'legacy' ? 50 : 1000;
  for (let page = 1; page <= maxPages; page++) {
    if (await ctx.shouldCancel?.()) {
      report.reason = 'cancelled';
      break;
    }
    let response;
    try {
      response = await transport(urlFor(strategy, page));
    } catch (error) {
      if (error instanceof SourceHttpError && [401, 403].includes(error.status)) throw error;
      if (!products.size) throw error;
      report.reason = 'source_error';
      report.warnings.push('La fuente falló después de recuperar páginas; resultado parcial.');
      break;
    }
    if (response.status < 200 || response.status >= 300) {
      if ([401, 403].includes(response.status) || !products.size)
        throw new SourceHttpError(response.status);
      report.reason = 'source_error';
      break;
    }
    const rows = strategy === 'intelligent-search' ? response.body?.products : response.body;
    if (!Array.isArray(rows)) {
      if (!products.size) throw new Error('Formato de catálogo VTEX inválido.');
      report.reason = 'invalid_page';
      break;
    }
    if (Number.isFinite(response.body?.recordsFiltered))
      report.estimatedTotal = response.body.recordsFiltered;
    if (!rows.length) {
      report.complete = true;
      break;
    }
    const fingerprint = rows
      .map((p: any) => String(p.productId))
      .sort()
      .join('|');
    if (pageIdentities.has(fingerprint)) {
      report.reason = 'repeated_page';
      break;
    }
    pageIdentities.add(fingerprint);
    for (const raw of rows) {
      const product = normalizeVtex(raw, config);
      const skipped = Math.max(
        0,
        (Array.isArray(raw.items) ? raw.items.length : 0) - (product?.variants?.length ?? 0)
      );
      report.excludedSkus = (report.excludedSkus ?? 0) + skipped;
      if (skipped && report.warnings.length < 30)
        report.warnings.push(
          `Producto ${String(raw.productId ?? '').slice(0, 100)}: ${skipped} SKU sin identidad u oferta válida; se conservan los anteriores.`
        );
      if (!product) {
        report.excluded++;
        continue;
      }
      if (!products.has(product.productId) && products.size < limit)
        products.set(product.productId, product);
    }
    if (products.size >= limit) {
      report.reason = 'target_limit';
      break;
    }
    if (rows.length < pageSize) {
      report.complete = true;
      break;
    }
    if (page === maxPages) report.reason = 'provider_limit';
  }
  report.fetched = products.size;
  if (
    report.estimatedTotal !== undefined &&
    products.size + report.excluded < report.estimatedTotal
  ) {
    report.complete = false;
    report.reason ??= 'source_partial';
  }
  if (!report.complete) report.warnings.push(`Recuperación parcial: ${report.reason ?? 'limit'}.`);
  ctx.report?.(report);
  return [...products.values()];
}
