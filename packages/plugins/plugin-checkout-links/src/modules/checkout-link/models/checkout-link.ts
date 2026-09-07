import { model } from '@medusajs/framework/utils';

/**
 * A preloaded checkout link. The operator authors one of these from the admin
 * (products, optional customer data, promos, expiry) and shares the resulting
 * public URL `/{country}/c/{token}`. The token is opaque; PII (email/address)
 * lives here in the DB, never in the URL.
 */
export const CheckoutLink = model
  .define('checkout_link', {
    id: model.id({ prefix: 'chkl' }).primaryKey(),
    token: model.text().unique(),
    internal_name: model.text().nullable(),
    items: model.json(),
    country_code: model.text(),
    region_id: model.text().nullable(),
    sales_channel_id: model.text().nullable(),
    email: model.text().nullable(),
    customer_id: model.text().nullable(),
    shipping_address: model.json().nullable(),
    promo_codes: model.json().nullable(),
    status: model.text().default('active'),
    single_use: model.boolean().default(false),
    used_count: model.number().default(0),
    expires_at: model.dateTime().nullable(),
    created_by: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['token'] }, { on: ['status'] }]);
