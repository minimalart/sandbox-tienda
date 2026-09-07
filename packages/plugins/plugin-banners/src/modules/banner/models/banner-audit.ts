import { model } from '@medusajs/framework/utils';

export const BannerAudit = model.define('banner_audit', {
  id: model.id({ prefix: 'baud' }).primaryKey(),
  banner_id: model.text(),
  action: model.text(),
  user_id: model.text().nullable(),
  changes: model.json().nullable(),
  snapshot: model.json().nullable(),
});

export default BannerAudit;
