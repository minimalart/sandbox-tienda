import { model } from '@medusajs/framework/utils';

/**
 * SeoAiVisibilitySnapshot — fotografía del AI Visibility Score por auditoría
 * (PRD §16). Permite el historial comparativo (junio 65 → julio 74 → agosto 82)
 * sin recalcular. Una fila por auditoría completada; el desglose replica los
 * subscores para graficar la evolución de cada dimensión. `coverage_percent` es
 * el AI Coverage del PRD §13 (% del catálogo con información suficiente).
 */
export const SeoAiVisibilitySnapshot = model
  .define('seo_ai_visibility_snapshot', {
    id: model.id({ prefix: 'seoviz' }).primaryKey(),
    audit_id: model.text(),
    sales_channel_id: model.text().nullable(),

    score: model.number().default(0),
    breakdown: model.json().nullable(),

    products_total: model.number().default(0),
    products_sufficient: model.number().default(0),
    coverage_percent: model.number().default(0),

    captured_at: model.dateTime(),
  })
  .indexes([
    { on: ['audit_id'], where: 'deleted_at IS NULL' },
    { on: ['sales_channel_id'], where: 'deleted_at IS NULL' },
    { on: ['captured_at'], where: 'deleted_at IS NULL' },
  ]);

export default SeoAiVisibilitySnapshot;
