import { model } from '@medusajs/framework/utils';

/** Alcance de un plan. variant > product > category > tag. */
export const SubscriptionTarget = model
  .define('subscription_target', {
    id: model.id({ prefix: 'stgt' }).primaryKey(),
    plan_id: model.text(),
    target_type: model.text(),
    target_id: model.text(),
    precedence: model.number().default(0),
    enabled: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['plan_id'] },
    { on: ['target_type', 'target_id'] },
  ]);

export default SubscriptionTarget;
