import { model } from '@medusajs/framework/utils';

/**
 * DeliveryRule (M6) — motor de reglas JSON-predicate que decide provider /
 * estrategia de ruta / recargo según condiciones derivadas de la orden.
 *
 * Patrón heredado de dynamic-groups (DynamicGroupCondition) y corporate
 * (CorporateRule.config): condiciones y acción como JSON, evaluadas por un motor
 * puro (src/modules/delivery/rules-engine.ts). El service las resuelve por zona.
 *
 *  - `delivery_zone_id`: si null, la regla es GLOBAL (aplica a todas las zonas).
 *  - `priority`: orden de evaluación, mayor primero. Se aplica la PRIMERA regla
 *    cuyas condiciones matchean (estrategia first-match, ver rules-engine.ts).
 *  - `conditions`: array de predicados [{ field, op, value }]. TODAS deben
 *    cumplirse (AND) para que la regla matchee.
 *  - `action`: { assign_provider?, route_strategy?, surcharge? } a aplicar.
 */
export const DeliveryRule = model
  .define('delivery_rule', {
    id: model.id({ prefix: 'drule' }).primaryKey(),
    name: model.text(),
    delivery_zone_id: model.text().nullable(),
    priority: model.number().default(0),
    conditions: model.json(),
    action: model.json(),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['delivery_zone_id'] },
    { on: ['active', 'priority'] },
  ]);

export default DeliveryRule;
