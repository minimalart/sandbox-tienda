import { model } from '@medusajs/framework/utils';

export const Banner = model
  .define('banner', {
    id: model.id({ prefix: 'banr' }).primaryKey(),
    internal_name: model.text().nullable(),
    handle: model.text().nullable(),
    type: model.text().nullable(),
    device_type: model.text().nullable(),
    placement: model.text(),
    status: model.text().default('draft'),
    priority: model.number().default(0),
    content: model.json().nullable(),
    media: model.json().nullable(),
    cta: model.json().nullable(),
    rules: model.json().nullable(),
    metadata: model.json().nullable(),
    start_at: model.dateTime().nullable(),
    end_at: model.dateTime().nullable(),
  })
  .indexes([
    { on: ['placement', 'status', 'priority'] },
    { on: ['start_at', 'end_at'] },
    { on: ['status'] },
  ]);
