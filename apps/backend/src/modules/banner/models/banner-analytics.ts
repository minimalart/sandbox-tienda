import { model } from '@medusajs/framework/utils';

export const BannerAnalytics = model.define('banner_analytics', {
  id: model.id({ prefix: 'bana' }).primaryKey(),
  banner_id: model.text(),
  impressions: model.number().default(0),
  clicks: model.number().default(0),
  last_impression_at: model.dateTime().nullable(),
  last_click_at: model.dateTime().nullable(),
});

export default BannerAnalytics;
