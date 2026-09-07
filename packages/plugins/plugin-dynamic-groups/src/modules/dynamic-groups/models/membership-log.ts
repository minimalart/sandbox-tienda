import { model } from '@medusajs/framework/utils';

/**
 * Historial/auditoría de pertenencia: cada vez que un cliente entra o sale de
 * un grupo dinámico se registra acá, con la razón (regla/atributos que lo
 * dispararon). Permite responder "¿por qué este cliente recibió/no recibió X?".
 */
export const DynamicGroupMembershipLog = model
  .define('dynamic_group_membership_log', {
    id: model.id({ prefix: 'dgml' }).primaryKey(),
    dynamic_group_id: model.text(),
    customer_id: model.text(),
    // 'added' | 'removed'
    action: model.text(),
    // { match, conditions, aggregates } — por qué entró/salió.
    reason: model.json().nullable(),
  })
  .indexes([{ on: ['dynamic_group_id'] }, { on: ['customer_id'] }]);

export default DynamicGroupMembershipLog;
