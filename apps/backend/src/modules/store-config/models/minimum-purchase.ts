import { model } from '@medusajs/framework/utils';

/**
 * MinimumPurchase — append-only audit log of the store's minimum purchase amount.
 *
 * Each change to the minimum purchase is a NEW record (no updates, no deletes),
 * so the full history is auditable. The "current" minimum at any point in time
 * is the record with the most recent `starts_at <= now` whose `ends_at` is null
 * or in the future (ties broken by `created_at` DESC).
 *
 * - `amount`: integer amount in the currency's major unit (NOT cents)
 * - `currency_code`: lowercase ISO currency code, defaults to 'ars'
 * - `starts_at`: when this minimum becomes effective
 * - `ends_at`: optional expiry; null = open-ended
 * - `note`: optional free-text reason for the change (audit context)
 */
export const MinimumPurchase = model
  .define('minimum_purchase', {
    id: model.id({ prefix: 'minpur' }).primaryKey(),
    amount: model.number(),
    currency_code: model.text().default('ars'),
    starts_at: model.dateTime(),
    ends_at: model.dateTime().nullable(),
    note: model.text().nullable(),
    /**
     * La tienda a la que aplica este mínimo. `NULL` = GLOBAL de la instancia.
     *
     * Es un log append-only, así que la columna no reescribe historia: los registros
     * viejos siguen siendo el mínimo global y una tienda que define el suyo empieza su
     * propia serie desde ese momento.
     */
    site_id: model.text().nullable(),
  })
  .indexes([{ on: ['starts_at'] }, { on: ['site_id'] }]);
