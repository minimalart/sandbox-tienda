import { model } from '@medusajs/framework/utils';

/**
 * Estados de una auditoría. La transición la controla el workflow/job de
 * ejecución; la UI sólo lee estados válidos.
 */
export const AUDIT_STATUSES = [
  'queued', // creada, aún no arrancó (o re-encolada tras pausar)
  'running', // crawl/análisis en curso
  'paused', // pausada por el usuario (corta en el próximo lote; se reanuda re-corriendo)
  'completed', // terminó bien
  'failed', // abortó por error
  'cancelled', // cancelada por el usuario
] as const;

export type AuditStatus = (typeof AUDIT_STATUSES)[number];

/**
 * Fases del pipeline (para mostrar progreso). Coinciden con los steps del
 * workflow: descubrimiento → crawl → análisis → scoring → cierre.
 */
export const AUDIT_PHASES = ['discovery', 'crawl', 'analyze', 'score', 'finalize'] as const;

export type AuditPhase = (typeof AUDIT_PHASES)[number];

/** Disparador de la auditoría (manual, programada o post-evento). */
export const AUDIT_TRIGGERS = ['manual', 'scheduled', 'post_import', 'post_content', 'post_publish'] as const;

/**
 * SeoAudit — un run completo de auditoría SEO/GEO (PRD §6/§16). Guarda la
 * configuración efectiva, el avance por fase, los scores agregados (SEO + AI
 * Visibility con su desglose) y el resumen. El detalle vive en las tablas de
 * páginas/enlaces/hallazgos y en los scores GEO por producto.
 */
export const SeoAudit = model
  .define('seo_audit', {
    id: model.id({ prefix: 'seoaud' }).primaryKey(),
    // Alcance: cada auditoría se ata a un sales channel (multi-demo). La URL
    // pública a crawlear se resuelve en runtime a partir de este canal.
    sales_channel_id: model.text().nullable(),
    base_url: model.text().nullable(),

    status: model.enum([...AUDIT_STATUSES]).default('queued'),
    current_phase: model.enum([...AUDIT_PHASES]).nullable(),
    trigger: model.enum([...AUDIT_TRIGGERS]).default('manual'),
    created_by: model.text().nullable(),

    // Config efectiva usada (presupuesto de páginas, motores activos, umbrales)
    config: model.json().nullable(),

    // Avance del crawl
    pages_crawled: model.number().default(0),
    pages_total: model.number().default(0),

    // Scores agregados (0-100). ai_visibility_breakdown guarda los subscores
    // (comprension, cobertura, autoridad, comparabilidad, datos_estructurados,
    // profundidad) para el desglose de la pantalla AI Visibility.
    seo_score: model.number().nullable(),
    ai_visibility_score: model.number().nullable(),
    ai_visibility_breakdown: model.json().nullable(),

    // Conteos de hallazgos por severidad (para listados rápidos)
    findings_summary: model.json().nullable(),
    error_summary: model.json().nullable(),

    started_at: model.dateTime().nullable(),
    completed_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['status'], where: 'deleted_at IS NULL' },
    { on: ['sales_channel_id'], where: 'deleted_at IS NULL' },
  ]);

export default SeoAudit;
