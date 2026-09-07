import { MedusaService } from '@medusajs/framework/utils';
import { MediaAsset } from './models';
import type { MediaAssetInput } from './types';

class MediaLibraryModuleService extends MedusaService({
  MediaAsset,
}) {
  /** Lista + búsqueda por nombre (ILIKE). */
  async search(q: string | undefined, opts: { limit?: number; offset?: number } = {}) {
    const filters = q
      ? { filename: { $ilike: `%${q}%` } }
      : ({} as Record<string, unknown>);
    return this.listAndCountMediaAssets(filters, {
      take: opts.limit ?? 100,
      skip: opts.offset ?? 0,
      order: { created_at: 'DESC' },
    });
  }

  /** Registra un asset; dedup por URL (si ya existe, lo devuelve). */
  async registerAsset(input: MediaAssetInput) {
    const existing = await this.listMediaAssets({ url: input.url });
    if (existing[0]) return existing[0];
    const created = await this.createMediaAssets({
      url: input.url,
      file_id: input.file_id ?? null,
      filename: input.filename,
      mime_type: input.mime_type ?? null,
      size: input.size ?? null,
      alt: input.alt ?? null,
      title: input.title ?? null,
      source: input.source ?? 'upload',
      metadata: input.metadata ?? null,
    });
    return Array.isArray(created) ? created[0] : created;
  }

  /** URLs ya presentes en el catálogo (para dedup en backfill). */
  async existingUrls(urls: string[]): Promise<Set<string>> {
    if (!urls.length) return new Set();
    const rows = await this.listMediaAssets({ url: urls });
    return new Set(rows.map((r) => r.url as string));
  }
}

export default MediaLibraryModuleService;
