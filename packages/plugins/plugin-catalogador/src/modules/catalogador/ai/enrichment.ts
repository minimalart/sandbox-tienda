import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import type { CatalogadorConfig } from '../config';
import { chatComplete, extractJson, type ChatMessage, type ChatUsage } from './openrouter';
import {
  buildEnrichmentMessages,
  TEXT_FIELDS,
  type ProductContext,
  type TextField,
} from './prompts';
import { loadTaxonomy, resolveCategoryIds, resolveTagIds, type Taxonomy } from './taxonomy';
import { gatherExternalContext } from './external';
import { pickProductBarcode } from './barcode';

/** Traza resumida de las fuentes usadas para una propuesta (PRD §13.3). */
export type SourceTrace = {
  catalog: boolean;
  image: boolean;
  barcode: boolean;
  scraping: boolean;
  ai_inferred: boolean;
};

export type ProposedField = {
  value: unknown;
  attempt: number;
  confidence: number | null;
  source_trace: SourceTrace;
  warnings?: string[];
};

export type GenerationResult = {
  proposed_changes: Record<string, ProposedField>;
  current_snapshot: Record<string, unknown>;
  product_version_reference: { hash: string; captured_at: string };
  external_context_summary: Record<string, unknown> | null;
  /** Imágenes reales encontradas en la web (para el pipeline de imágenes). */
  external_image_candidates: string[];
  warnings: string[];
  usage?: ChatUsage;
  no_changes: boolean;
};

/**
 * Confianza según la fuerza de la evidencia disponible (PRD §13). No es un
 * sistema sofisticado: mapea las fuentes que realmente alimentaron la propuesta
 * a un valor orientativo.
 *
 * La foto del producto cuenta como evidencia de primera mano: cuando hay imagen
 * el modelo la mira (va como `image_url` en el mensaje) y describe lo que ve, no
 * lo que deduce del título. Antes esta función sólo puntuaba barcode y scraping
 * —las dos fuentes EXTERNAS—, así que un tenant con ambas apagadas en su config
 * tenía un techo alcanzable de 0.55 contra el umbral por default de 0.7: el gate
 * de `require_review_low_confidence` difería el 100% de los campos siempre y
 * "aceptar todo" era incapaz de aceptar nada. Un gate cuyo techo está por debajo
 * de su propio umbral no discrimina: sólo apaga el botón.
 *
 * Con la imagen puntuando, el gate vuelve a separar dos casos que sí son
 * distintos: producto CON foto (0.7, el modelo vio el envase) y producto SIN
 * foto (0.55, la IA está infiriendo del catálogo) — que es justo donde querés
 * ojo humano.
 */
export function evidenceConfidence(opts: { usedBarcode: boolean; pageHits: number; hasImage: boolean }): number {
  if (opts.usedBarcode && opts.pageHits >= 1) return 0.9; // barcode + página
  if (opts.usedBarcode) return 0.8; // API barcode con respuesta
  if (opts.pageHits >= 2) return 0.7; // dos páginas coincidentes
  if (opts.hasImage) return 0.7; // el modelo vio la foto del producto
  if (opts.pageHits >= 1) return 0.6; // una página
  return 0.55; // sólo inferencia del catálogo, sin foto
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Descarga una imagen pública y la vuelve data URL para visión (best-effort). */
async function fetchImageDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    const mime = res.headers.get('content-type') || 'image/jpeg';
    if (!mime.startsWith('image/')) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function stableHash(obj: unknown): string {
  const str = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

/** Campos de texto libres protegidos por la regla "no sobrescribir manual". */
const FREEFORM_FIELDS: TextField[] = ['subtitle', 'description', 'meta_title', 'meta_description', 'alt_text'];

/**
 * Genera propuestas para un producto (PRD §13.1). Orden: lee info existente →
 * taxonomías → imagen → contexto externo (barcode/scraping) → IA → validación.
 * NO escribe en el catálogo: sólo devuelve las propuestas para revisión.
 */
export async function generateForProduct(opts: {
  container: MedusaContainer;
  productId: string;
  fields: TextField[];
  config: CatalogadorConfig;
  taxonomy: Taxonomy;
  attempt: number;
}): Promise<GenerationResult> {
  const { container, productId, config, taxonomy, attempt } = opts;
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fields = opts.fields.filter((f) => (TEXT_FIELDS as readonly string[]).includes(f)) as TextField[];
  const warnings: string[] = [];

  const { data } = await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'subtitle',
      'description',
      'status',
      'thumbnail',
      'metadata',
      'images.url',
      'collection.title',
      'categories.id',
      'categories.name',
      'tags.id',
      'tags.value',
      'variants.sku',
      'variants.barcode',
      'variants.ean',
      'variants.upc',
      'variants.metadata',
    ],
    filters: { id: productId },
  });
  const product = (data as Array<Record<string, unknown>>)[0];
  if (!product) throw new Error(`Producto ${productId} no encontrado`);

  const variants =
    (product.variants as Array<{
      sku?: string;
      barcode?: string;
      ean?: string;
      upc?: string;
      metadata?: Record<string, unknown> | null;
    }>) ?? [];
  const images = (product.images as Array<{ url?: string }>) ?? [];
  const thumbnail = (product.thumbnail as string) || images[0]?.url || null;

  const ctx: ProductContext = {
    title: product.title as string,
    subtitle: (product.subtitle as string) ?? null,
    description: (product.description as string) ?? null,
    collection: (product.collection as { title?: string })?.title ?? null,
    brand: null,
    category_paths: ((product.categories as Array<{ name?: string }>) ?? [])
      .map((c) => c.name)
      .filter(Boolean) as string[],
    tag_values: ((product.tags as Array<{ value?: string }>) ?? [])
      .map((t) => t.value)
      .filter(Boolean) as string[],
    variant_skus: variants.map((v) => v.sku).filter(Boolean) as string[],
    metadata: (product.metadata as Record<string, unknown>) ?? null,
    has_image: Boolean(thumbnail),
  };

  // Imágenes para visión (sólo si aporta a campos de contenido). Se usan TODAS
  // las imágenes del producto como referencia (no sólo la principal), hasta un
  // tope para no inflar el payload.
  const MAX_VISION_IMAGES = 6;
  const wantsVision = fields.some((f) => ['description', 'subtitle', 'alt_text', 'categories', 'tags'].includes(f));
  const allImageUrls = [thumbnail, ...images.map((i) => i.url)].filter(
    (u): u is string => Boolean(u)
  );
  const uniqueImageUrls = [...new Set(allImageUrls)].slice(0, MAX_VISION_IMAGES);
  const imageDataUrls = wantsVision
    ? (await Promise.all(uniqueImageUrls.map((u) => fetchImageDataUrl(u)))).filter(
        (u): u is string => Boolean(u)
      )
    : [];

  // Contexto externo (barcode/scraping) — sólo como referencia (PRD §13.2).
  // El código se toma de barcode/ean/upc/metadata/sku (no sólo `barcode`) y se
  // valida el formato antes de consultar.
  const barcode = pickProductBarcode(variants);
  const external = await gatherExternalContext({ config, barcode, title: ctx.title });
  if (external?.warnings?.length) warnings.push(...external.warnings);

  const { system, userText } = buildEnrichmentMessages({
    config,
    fields,
    product: ctx,
    allowedCategories: taxonomy.categories.map((c) => c.path),
    allowedTags: taxonomy.tags.map((t) => t.value),
    imageDataUrl: imageDataUrls[0] ?? null,
    externalContext: external?.summary ?? null,
  });

  const userContent: ChatMessage =
    imageDataUrls.length > 0
      ? {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            ...imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ],
        }
      : { role: 'user', content: userText };

  const { content, usage } = await chatComplete({
    model: config.text.model,
    messages: [{ role: 'system', content: system }, userContent],
    temperature: config.text.temperature,
    maxTokens: config.text.max_tokens,
    reasoningEffort: config.text.reasoning_effort,
    jsonMode: true,
  });

  const parsed = extractJson<Record<string, unknown>>(content);
  if (!parsed) {
    throw new Error('El modelo no devolvió un JSON válido.');
  }

  const sourceTrace: SourceTrace = {
    catalog: true,
    image: imageDataUrls.length > 0,
    barcode: Boolean(external?.used_barcode),
    scraping: Boolean(external?.used_scraping),
    ai_inferred: true,
  };

  // Confianza base derivada de la evidencia externa real (no una constante).
  const baseConfidence = evidenceConfidence({
    usedBarcode: Boolean(external?.used_barcode),
    pageHits: external?.page_hits ?? 0,
    hasImage: imageDataUrls.length > 0,
  });

  const proposed: Record<string, ProposedField> = {};
  const snapshot: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = parsed[field];
    if (raw === undefined || raw === null) continue;

    // Reglas de catálogo (PRD §22.5).
    const currentVal = currentFieldValue(product, ctx, field);
    snapshot[field] = currentVal ?? null;

    const isFreeform = FREEFORM_FIELDS.includes(field);
    const hasManualValue =
      currentVal != null && String(currentVal).trim() !== '' && (!Array.isArray(currentVal) || currentVal.length > 0);

    if (config.rules.only_fill_empty && hasManualValue) continue;
    if (config.rules.do_not_overwrite_manual && isFreeform && hasManualValue && !config.rules.allow_improve_existing) {
      continue;
    }

    let value: unknown = raw;
    const fieldWarnings: string[] = [];

    if (field === 'categories') {
      const names = Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
      const ids = resolveCategoryIds(taxonomy, names);
      if (names.length && !ids.length) fieldWarnings.push('Ninguna categoría propuesta coincide con las existentes.');
      value = ids;
      if (!ids.length) continue;
    } else if (field === 'tags') {
      const values = Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
      const ids = resolveTagIds(taxonomy, values);
      if (values.length && !ids.length) fieldWarnings.push('Ningún tag propuesto coincide con los existentes.');
      value = ids;
      if (!ids.length) continue;
    } else if (field === 'keywords') {
      value = Array.isArray(raw) ? (raw as unknown[]).map(String) : String(raw).split(',').map((s) => s.trim());
    } else {
      value = String(raw).trim();
      if (!value) continue;
    }

    // Un campo con advertencias (p.ej. categorías/tags que no matchearon) baja
    // a la confianza mínima aunque la evidencia global sea fuerte.
    const confidence = fieldWarnings.length ? Math.min(baseConfidence, 0.55) : baseConfidence;

    proposed[field] = {
      value,
      attempt,
      confidence,
      source_trace: sourceTrace,
      warnings: fieldWarnings.length ? fieldWarnings : undefined,
    };
  }

  return {
    proposed_changes: proposed,
    current_snapshot: snapshot,
    product_version_reference: { hash: stableHash(snapshot), captured_at: new Date().toISOString() },
    external_context_summary: external
      ? { used_barcode: external.used_barcode, used_scraping: external.used_scraping, sources: external.sources }
      : null,
    external_image_candidates: external?.image_candidates ?? [],
    warnings,
    usage,
    no_changes: Object.keys(proposed).length === 0,
  };
}

/** Valor actual del campo (para snapshot + reglas). */
function currentFieldValue(
  product: Record<string, unknown>,
  ctx: ProductContext,
  field: TextField
): unknown {
  switch (field) {
    case 'subtitle':
      return ctx.subtitle;
    case 'description':
      return ctx.description;
    case 'categories':
      return ((product.categories as Array<{ id?: string }>) ?? []).map((c) => c.id).filter(Boolean);
    case 'tags':
      return ((product.tags as Array<{ id?: string }>) ?? []).map((t) => t.id).filter(Boolean);
    case 'meta_title':
      return (ctx.metadata?.meta_title as string) ?? null;
    case 'meta_description':
      return (ctx.metadata?.meta_description as string) ?? null;
    case 'keywords':
      return (ctx.metadata?.keywords as unknown) ?? null;
    case 'alt_text':
      return (ctx.metadata?.alt_text as string) ?? null;
    default:
      return null;
  }
}

export { loadTaxonomy };
