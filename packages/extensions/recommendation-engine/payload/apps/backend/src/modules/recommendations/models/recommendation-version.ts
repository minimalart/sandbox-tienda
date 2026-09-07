import { model } from '@medusajs/framework/utils';

/**
 * Estados de un lote de relaciones (PRD §12).
 *
 * `building` es además la entrada de cola: el scheduler crea la fila y el
 * drainer la levanta (mismo patrón que las auditorías `queued` de seo-geo).
 */
export const VERSION_STATUSES = [
  'building', // en construcción (invisible para el serve)
  'ready', // construida y validada, aún no activa
  'active', // sirviendo (una sola por estrategia+canal, garantizado por índice)
  'superseded', // reemplazada por una versión más nueva
  'failed', // abortada; la versión anterior sigue activa
] as const;

export type VersionStatus = (typeof VERSION_STATUSES)[number];

/** Quién disparó el recálculo. */
export const VERSION_TRIGGERS = ['cron', 'manual', 'api'] as const;

export type VersionTrigger = (typeof VERSION_TRIGGERS)[number];

/**
 * RecommendationVersion — un lote de relaciones generado por un recálculo
 * (PRD §11.4) y, a la vez, el LOG DE OBSERVABILIDAD de esa corrida (PRD §20).
 *
 * No hay tabla de runs aparte porque los campos que pide el §20 (estrategia,
 * inicio, fin, estado, eventos procesados, órdenes analizadas, relaciones
 * generadas/descartadas, duración, errores, versión) son 1:1 con un build.
 * Precedente: `seo_audit` lleva estado y contadores en la misma fila.
 *
 * `cursor` + `processed_count` hacen el build RESUMIBLE: el recálculo de
 * similares abarca todo el catálogo y tiene que poder cortarse al agotar el
 * presupuesto de tiempo del tick y seguir en el siguiente, sobreviviendo a un
 * restart del contenedor.
 */
export const RecommendationVersion = model
  .define('recommendation_version', {
    id: model.id({ prefix: 'recver' }).primaryKey(),

    strategy_key: model.text(),
    sales_channel_id: model.text().nullable(),
    status: model.enum([...VERSION_STATUSES]).default('building'),
    triggered_by: model.enum([...VERSION_TRIGGERS]).default('cron'),

    started_at: model.dateTime().nullable(),
    finished_at: model.dateTime().nullable(),
    activated_at: model.dateTime().nullable(),
    duration_ms: model.number().nullable(),

    // Progreso del build resumible.
    cursor: model.text().nullable(),
    processed_count: model.number().default(0),

    // Log de la corrida (PRD §20).
    events_processed: model.number().default(0),
    orders_analyzed: model.number().default(0),
    relations_generated: model.number().default(0),
    relations_discarded: model.number().default(0),
    error_summary: model.json().nullable(),
    // Config efectiva usada, congelada al arrancar: si el merchant cambia los
    // mínimos a mitad de un build, la corrida sigue con los que empezó.
    config_snapshot: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['strategy_key', 'status'], where: 'deleted_at IS NULL' },
    // Reconciliación de corridas colgadas (crash / OOM / deploy a mitad).
    { on: ['status', 'updated_at'] },
    // NOTA: el índice único parcial que garantiza "una sola versión activa por
    // estrategia+canal" usa COALESCE sobre una columna nullable, así que no se
    // puede expresar con `.indexes()`: se escribe a mano en la migración
    // (UQ_recommendation_version_active).
  ]);

export default RecommendationVersion;
