import { model } from '@medusajs/framework/utils';

/**
 * SeoAuditLink — una arista del grafo de enlaces internos/externos descubierto
 * durante el crawl (PRD §8). Habilita las detecciones de arquitectura: páginas
 * huérfanas (sin inlinks internos) y enlaces internos rotos (target ≥400).
 * Portado del `auditLinks` de open-seo (MIT).
 */
export const SeoAuditLink = model
  .define('seo_audit_link', {
    id: model.id({ prefix: 'seolnk' }).primaryKey(),
    audit_id: model.text(),
    source_page_id: model.text(),
    target_url: model.text(),
    anchor: model.text().nullable(),
    is_internal: model.boolean().default(true),
    is_nofollow: model.boolean().default(false),
  })
  .indexes([
    { on: ['audit_id'], where: 'deleted_at IS NULL' },
    { on: ['source_page_id'], where: 'deleted_at IS NULL' },
    { on: ['audit_id', 'target_url'], where: 'deleted_at IS NULL' },
  ]);

export default SeoAuditLink;
