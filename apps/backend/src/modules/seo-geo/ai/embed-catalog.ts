import type { MedusaContainer } from '@medusajs/framework/types';
import { createHash } from 'node:crypto';
import { SEO_GEO_MODULE } from '../index';
import type SeoGeoModuleService from '../service';
import { loadGeoProducts } from '../geo/load-products';
import type { GeoProductInput } from '../geo/types';
import { embedTexts, getEmbeddingModelName, isEmbeddingConfigured } from './embedding-client';

/** Texto que representa al producto para el embedding (lo que un LLM "leería"). */
export function buildEmbedText(p: GeoProductInput): string {
  const parts = [
    p.title,
    p.subtitle,
    p.brand ? `Marca: ${p.brand}` : null,
    p.categories.length ? `Categorías: ${p.categories.join(', ')}` : null,
    p.material ? `Material: ${p.material}` : null,
    p.tags.length ? `Tags: ${p.tags.join(', ')}` : null,
    (p.description ?? '').replace(/<[^>]+>/g, ' '),
  ];
  return parts.filter(Boolean).join('. ').replace(/\s+/g, ' ').trim();
}

function hashText(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export type EmbedResult = { embedded: number; skipped: number; total: number };

/**
 * Embebe (incrementalmente) el catálogo para el Simulador IA (PRD §12). Saltea
 * productos sin cambios (mismo hash + mismo modelo). Pensado para correr por job
 * en lotes acotados; `limit` topea cuántos productos NUEVOS/cambiados procesa por
 * corrida para no disparar el costo.
 */
export async function embedCatalog(
  container: MedusaContainer,
  opts: { salesChannelId?: string | null; max: number; limit: number }
): Promise<EmbedResult> {
  if (!isEmbeddingConfigured()) {
    return { embedded: 0, skipped: 0, total: 0 };
  }
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const model = getEmbeddingModelName();

  const products = await loadGeoProducts(container, { salesChannelId: opts.salesChannelId, max: opts.max });

  // Índice de embeddings existentes por product_id
  const existing = await service.listSeoGeoProductEmbeddings({}, { take: null as unknown as number });
  const byProduct = new Map<string, { id: string; text_hash: string | null; model: string }>();
  for (const e of existing) byProduct.set(e.product_id, { id: e.id, text_hash: e.text_hash, model: e.model });

  // Determinar qué hay que (re)embeber
  const pending: Array<{ p: GeoProductInput; text: string; hash: string }> = [];
  let skipped = 0;
  for (const p of products) {
    const text = buildEmbedText(p);
    const hash = hashText(`${model}:${text}`);
    const prev = byProduct.get(p.id);
    if (prev && prev.text_hash === hash && prev.model === model) {
      skipped += 1;
      continue;
    }
    pending.push({ p, text, hash });
    if (pending.length >= opts.limit) break;
  }

  if (pending.length === 0) return { embedded: 0, skipped, total: products.length };

  const vectors = await embedTexts(pending.map((x) => x.text));

  for (let i = 0; i < pending.length; i++) {
    const item = pending[i];
    const vec = vectors[i];
    if (!item || !vec) continue;
    const prev = byProduct.get(item.p.id);
    const row = {
      product_id: item.p.id,
      product_title: item.p.title,
      product_handle: null,
      model,
      dims: vec.length,
      text_hash: item.hash,
      content: item.text.slice(0, 2000),
      embedding: vec,
    };
    if (prev) await service.updateSeoGeoProductEmbeddings({ id: prev.id, ...row } as never);
    else await service.createSeoGeoProductEmbeddings(row as never);
  }

  return { embedded: pending.length, skipped, total: products.length };
}
