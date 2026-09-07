import { model } from '@medusajs/framework/utils';

/**
 * Motor que produjo el hallazgo (PRD §9/§10).
 *
 * `crawl` no es un motor de análisis: son los chequeos de salud del crawl mismo
 * (`engines/crawl-health.ts`), que corren siempre y reportan cuándo la auditoría
 * no pudo mirar el sitio. Van como hallazgos —y no sólo como `error_summary`—
 * para que aparezcan en la pantalla de Hallazgos, que es donde se mira.
 */
export const FINDING_ENGINES = ['technical', 'architecture', 'catalog', 'geo', 'commercial', 'performance', 'crawl'] as const;

export type FindingEngine = (typeof FINDING_ENGINES)[number];

/** Severidad, mapeada a los 3 niveles de open-seo. */
export const FINDING_SEVERITIES = ['critical', 'warning', 'info'] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/** Tipo de entidad afectada. */
export const FINDING_ENTITY_TYPES = ['page', 'product', 'category', 'collection', 'site'] as const;

/** Ciclo de vida del hallazgo. */
export const FINDING_STATUSES = ['open', 'fixed', 'dismissed'] as const;

export type FindingStatus = (typeof FINDING_STATUSES)[number];

/**
 * SeoFinding — un hallazgo accionable (PRD §14/§15). Una fila por (tipo, target)
 * dentro de una auditoría. `type` es un slug estable (ej. 'missing-title',
 * 'thin-content', 'geo-no-use-cases') que la UI usa para agrupar, mostrar copy
 * y ofrecer la corrección correspondiente. `details` lleva contexto (valores,
 * umbral superado, campo faltante). Portado del `auditIssues` de open-seo (MIT),
 * extendido con entidad de Medusa y estado de resolución.
 */
export const SeoFinding = model
  .define('seo_finding', {
    id: model.id({ prefix: 'seofnd' }).primaryKey(),
    audit_id: model.text(),
    engine: model.enum([...FINDING_ENGINES]),
    type: model.text(),
    severity: model.enum([...FINDING_SEVERITIES]).default('warning'),

    // Target del hallazgo
    entity_type: model.enum([...FINDING_ENTITY_TYPES]).default('page'),
    entity_id: model.text().nullable(),
    page_url: model.text().nullable(),

    details: model.json().nullable(),
    status: model.enum([...FINDING_STATUSES]).default('open'),
    // Impacto estimado 0-100 para priorización (severidad + señales de negocio
    // cuando el motor comercial esté disponible).
    impact: model.number().nullable(),
  })
  .indexes([
    { on: ['audit_id'], where: 'deleted_at IS NULL' },
    { on: ['audit_id', 'engine'], where: 'deleted_at IS NULL' },
    { on: ['audit_id', 'severity'], where: 'deleted_at IS NULL' },
    { on: ['entity_type', 'entity_id'], where: 'deleted_at IS NULL' },
    { on: ['status'], where: 'deleted_at IS NULL' },
  ]);

export default SeoFinding;
