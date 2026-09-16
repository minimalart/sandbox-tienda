import type {
  ImporterContext,
  NormalizedProduct,
  NormalizedVariant,
} from '../../../lib/catalog/types';
import { buildHandle, stripHtml } from '../../../lib/catalog/util';
import type { CatalogCommercial } from '../../../lib/catalog/commercial';
import type { ConnectionConfig } from '../config';
import { publicJson, type JsonTransport } from '../http';
import { recoverVtexPages } from './vtex-pagination';

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
    ...(Array.isArray(item.variations)
      ? item.variations.filter((v: any) => typeof v === 'object' && v)
      : []),
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
    // Identity is technical metadata. Never use an external ID as a display value.
    const dimensions = Array.isArray(item.variations)
      ? item.variations.map((d: any) => (typeof d === 'string' ? d : d.name)).filter(Boolean)
      : [];
    const label =
      presentation.label?.trim() ||
      dimensions
        .map((d: string) => property(raw, item, d))
        .filter(Boolean)
        .join(' / ') ||
      [item.name, item.nameComplete]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .find((value) => value && value !== id && value !== productId && value !== title) ||
      'Único';
    variants.push({
      externalVariantId: id,
      sku: String(item.referenceId?.[0]?.Value ?? id),
      value: label,
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

/** Recover all query partitions while preserving source identity and diagnostics. */
export async function fetchVtexCatalog(
  ctx: ImporterContext,
  transport: JsonTransport = publicJson
): Promise<NormalizedProduct[]> {
  return recoverVtexPages(ctx, transport, normalizeVtex);
}
