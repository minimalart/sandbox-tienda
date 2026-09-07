import { model } from '@medusajs/framework/utils';

/**
 * Regla comercial por empresa. `type` define el comportamiento, `config` (JSON)
 * los parámetros (ej. { amount } o { ids: [...] }).
 */
export const CorporateRule = model
  .define('corporate_rule', {
    id: model.id({ prefix: 'crul' }).primaryKey(),
    corporate_id: model.text(),
    type: model.text(),
    config: model.json(),
    enabled: model.boolean().default(true),
  })
  .indexes([{ on: ['corporate_id'] }, { on: ['type'] }]);

export default CorporateRule;
