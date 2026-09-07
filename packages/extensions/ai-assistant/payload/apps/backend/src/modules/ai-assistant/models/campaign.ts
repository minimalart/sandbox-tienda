import { model } from '@medusajs/framework/utils';

/**
 * Campaña comercial: el ESTADO COMPARTIDO + el CHECKLIST del wizard guiado que
 * conduce el Orquestador (brief → entregables → productos → promoción → tono →
 * ejecución → preview → confirmación). Es la fuente de verdad del flujo: cada
 * bloque interactivo del chat persiste su patch acá (sin que el LLM tenga que
 * mantener el JSON en su contexto), y el motor de workflows recibe `state` como
 * `input` en la fase de ejecución y vuelca los outputs de vuelta.
 *
 * - `state`: el "estado compartido" del PRD —
 *   { campaign:{name,objective[],start_date,end_date,customer_groups[],tone},
 *     deliverables:{blog_post,banner,promotion,landing},
 *     product_selection:{mode,category_ids[],tag_ids[],product_ids[]},
 *     promotion:{type,value,applies_to,customer_groups[]},
 *     outputs:{blog_post,banner,landing,promotion},
 *     validation:{is_ready,warnings[],missing_fields[]} }
 * - `checklist`: Array<{ key, label, status }> con status
 *   'pending' | 'active' | 'done' (✓/→/○ del PRD).
 * - `workflow_run_id`: link a la corrida del motor (fase de ejecución).
 */
export const Campaign = model.define('ai_campaign', {
  id: model.id().primaryKey(),
  thread_id: model.text().nullable(),
  name: model.text(),
  status: model
    .enum(['draft', 'intake', 'executing', 'preview', 'confirmed', 'cancelled'])
    .default('intake'),
  state: model.json().nullable(),
  checklist: model.json().nullable(),
  workflow_run_id: model.text().nullable(),
  created_by: model.text().nullable(),
});
