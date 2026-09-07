import { model } from '@medusajs/framework/utils';

/** Frecuencia y beneficio elegibles dentro de una version de plan. */
export const SubscriptionPlanOffer = model
  .define('subscription_plan_offer', {
    id: model.id({ prefix: 'spoff' }).primaryKey(),
    plan_id: model.text(),
    label: model.text().nullable(),
    frequency_interval: model.text(),
    frequency_count: model.number().default(1),
    discount_type: model.text().default('none'),
    discount_value: model.number().default(0),
    currency_code: model.text().nullable(),
    fixed_unit_prices: model.json().nullable(),
    sort_order: model.number().default(0),
    enabled: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['plan_id'] }, { on: ['enabled'] }]);

export default SubscriptionPlanOffer;
