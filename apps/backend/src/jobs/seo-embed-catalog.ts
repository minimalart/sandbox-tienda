import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getSeoGeoConfig } from '../modules/seo-geo/config';
import { embedCatalog } from '../modules/seo-geo/ai/embed-catalog';
import { isEmbeddingConfigured } from '../modules/seo-geo/ai/embedding-client';
import { getSeoGeoSettings } from '../modules/seo-geo/settings';

/**
 * Job del módulo SEO & GEO: embebe el catálogo para el Simulador IA de forma
 * incremental (saltea productos sin cambios) y en lotes acotados por corrida,
 * para no disparar el costo de embeddings. Desactivado si no hay IA configurada.
 */
export const config = {
  name: 'seo-embed-catalog',
  schedule: process.env.SEO_GEO_EMBED_SCHEDULE || '*/10 * * * *',
};

export default async function seoEmbedCatalogJob(container: MedusaContainer): Promise<void> {
  if (!isEmbeddingConfigured()) return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const cfg = await getSeoGeoConfig(container);
  if (!cfg.simulator.enabled) return;

  const res = await embedCatalog(container, {
    salesChannelId: null,
    max: cfg.crawl.max_pages * 20,
    limit: getSeoGeoSettings().embedBatch,
  });
  if (res.embedded > 0) {
    logger.info(`[seo-geo] embed catálogo: ${res.embedded} embebidos, ${res.skipped} sin cambios (${res.total} total)`);
  }
}
