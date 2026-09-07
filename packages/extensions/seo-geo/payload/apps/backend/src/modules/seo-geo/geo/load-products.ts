import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { GeoProductInput } from './types';

const PAGE = 200;

/**
 * Carga los productos publicados (opcionalmente de un sales channel) y los
 * normaliza a `GeoProductInput` para el scoring GEO y el motor de catálogo. Lee
 * sólo por `query.graph` (sin acoplar a la extensión de marcas: la marca se
 * infiere de metadata). Pagina y corta en `max` para acotar el costo.
 */
export async function loadGeoProducts(
  container: MedusaContainer,
  opts: { salesChannelId?: string | null; max: number }
): Promise<GeoProductInput[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const out: GeoProductInput[] = [];

  const filters: Record<string, unknown> = { status: 'published' };
  if (opts.salesChannelId) filters.sales_channels = { id: opts.salesChannelId };

  for (let offset = 0; offset < opts.max; offset += PAGE) {
    const take = Math.min(PAGE, opts.max - offset);
    const { data } = await query.graph({
      entity: 'product',
      fields: [
        'id',
        'title',
        'subtitle',
        'description',
        'material',
        'weight',
        'length',
        'height',
        'width',
        'type.value',
        'metadata',
        'images.url',
        'collection.title',
        'categories.name',
        'tags.value',
        'options.title',
        'variants.sku',
        'variants.barcode',
        'variants.ean',
        'variants.upc',
      ],
      filters,
      pagination: { skip: offset, take },
    });

    const rows = data as Array<Record<string, unknown>>;
    if (rows.length === 0) break;
    for (const p of rows) out.push(normalize(p));
    if (rows.length < take) break;
  }

  return out;
}

function normalize(p: Record<string, unknown>): GeoProductInput {
  const metadata = (p.metadata as Record<string, unknown>) ?? {};
  const images = (p.images as Array<{ url?: string }>) ?? [];
  const variants =
    (p.variants as Array<{ sku?: string; barcode?: string; ean?: string; upc?: string }>) ?? [];
  const brand =
    (typeof metadata.brand === 'string' && metadata.brand) ||
    (typeof metadata.marca === 'string' && metadata.marca) ||
    null;
  const hasFaq =
    Boolean(metadata.faq) ||
    Boolean(metadata.faqs) ||
    Boolean(metadata.preguntas_frecuentes);

  const imagesCount = images.length;

  return {
    id: p.id as string,
    title: (p.title as string) ?? null,
    subtitle: (p.subtitle as string) ?? null,
    description: (p.description as string) ?? null,
    material: (p.material as string) ?? null,
    weight: (p.weight as number) ?? null,
    length: (p.length as number) ?? null,
    height: (p.height as number) ?? null,
    width: (p.width as number) ?? null,
    tags: ((p.tags as Array<{ value?: string }>) ?? []).map((t) => t.value).filter(Boolean) as string[],
    categories: ((p.categories as Array<{ name?: string }>) ?? []).map((c) => c.name).filter(Boolean) as string[],
    collection: (p.collection as { title?: string })?.title ?? null,
    type: (p.type as { value?: string })?.value ?? null,
    brand,
    variants: variants.map((v) => ({
      sku: v.sku ?? null,
      barcode: v.barcode ?? null,
      ean: v.ean ?? null,
      upc: v.upc ?? null,
    })),
    option_titles: ((p.options as Array<{ title?: string }>) ?? []).map((o) => o.title).filter(Boolean) as string[],
    images_count: imagesCount,
    // El alt real de imágenes lo evalúa el motor técnico sobre el HTML crawleado;
    // desde datos de producto asumimos presente para no generar falsos positivos.
    images_with_alt: imagesCount,
    metadata_keys: Object.keys(metadata).filter((k) => !['brand', 'marca'].includes(k)),
    has_faq: hasFaq,
  };
}
