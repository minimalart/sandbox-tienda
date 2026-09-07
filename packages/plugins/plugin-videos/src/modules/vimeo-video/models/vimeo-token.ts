import { model } from '@medusajs/framework/utils';

export const VimeoToken = model.define('vimeo_token', {
  id: model.id().primaryKey(),
  access_token: model.text(),
  refresh_token: model.text().nullable(),
  token_type: model.text(),
  scope: model.text().nullable(),
  expires_at: model.dateTime(),
  user_id: model.text().nullable(),
});
