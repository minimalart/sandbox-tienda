import { model } from '@medusajs/framework/utils';

import { FLOW_VERSION_STATUSES } from '../types';

/**
 * Una versión del grafo de conversación.
 *
 * UNA SOLA TABLA, no `flow` + `flow_version`: el "flujo" es apenas una key, y una
 * tabla de identidades con una fila no compra nada. Listar los flujos que existen
 * es un `distinct flow_key`.
 *
 * EL GRAFO VA COMO JSON y no en tablas de nodos y aristas. Se edita entero desde el
 * canvas y no hay una sola consulta que pida "los nodos tal": partirlo agregaría
 * joins y una migración por cada campo nuevo del editor, a cambio de nada. Mismo
 * criterio que `demo_store.home_puck_data` y `ai_workflow.steps`.
 *
 * LOS DOS INVARIANTES —una activa y un borrador por flujo y tienda— son índices
 * únicos PARCIALES en la migración, no convención de código. No se pueden declarar
 * acá porque usan `coalesce` sobre una columna nullable: sin eso, `site_id = null`
 * nunca matchearía y dos publicaciones concurrentes dejarían dos activas. Mismo
 * problema y misma solución que `UQ_recommendation_version_active`.
 */
export const WhatsappFlowVersion = model
  .define('whatsapp_flow_version', {
    id: model.id({ prefix: 'waflw' }).primaryKey(),

    flow_key: model.text(),
    /** `NULL` = el flujo de la instancia, el que usa toda tienda sin uno propio. */
    site_id: model.text().nullable(),

    status: model.enum([...FLOW_VERSION_STATUSES]).default('draft'),
    /** Número legible para el operador ("versión 7"), no el id. */
    version: model.number().default(1),

    name: model.text().nullable(),
    /** `{ nodes, edges }` — ver `lib/whatsapp/flow/graph.ts`. */
    graph: model.json().nullable(),
    /** Qué cambió. Lo escribe quien publica. */
    notes: model.text().nullable(),

    published_at: model.dateTime().nullable(),
    published_by: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['flow_key', 'status'], where: 'deleted_at IS NULL' },
    { on: ['flow_key', 'site_id', 'version'], where: 'deleted_at IS NULL' },
  ]);
