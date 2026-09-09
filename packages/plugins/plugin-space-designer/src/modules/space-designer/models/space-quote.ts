import { model } from '@medusajs/framework/utils';
/**
 * A quote request: the shopper sends the design instead of buying it, so the
 * store answers with a price. Contact data is captured verbatim; the priced
 * catalogue is NOT snapshotted because a quote is answered by a person.
 */
export const SpaceQuote = model
  .define('space_quote', {
    id: model.id({ prefix: 'spqte' }).primaryKey(),
    configurator_id: model.text(),
    configurator_title: model.text(),
    sales_channel_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    name: model.text(),
    email: model.text(),
    phone: model.text().nullable(),
    message: model.text().nullable(),
    template_id: model.text().nullable(),
    template_name: model.text().nullable(),
    snapshot: model.json(),
    items: model.json(),
    status: model.enum(['new', 'contacted', 'closed']).default('new'),
  })
  .indexes([
    { on: ['configurator_id'], where: 'deleted_at IS NULL' },
    { on: ['sales_channel_id'], where: 'deleted_at IS NULL' },
    { on: ['status'], where: 'deleted_at IS NULL' },
  ]);
