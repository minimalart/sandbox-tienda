import { model } from '@medusajs/framework/utils';

/**
 * Catálogo CRUDO de medios de pago sincronizado desde un proveedor (MP:
 * GET /v1/payment_methods + snapshot de cuotas sin interés vía
 * GET /v1/payment_methods/installments). Separado de `payment_benefit` para
 * distinguir el dato oficial del proveedor de los beneficios curados.
 *
 * Único por (provider_code, external_id) — se upsertea en cada sync.
 */
export const PaymentMethodCatalog = model
  .define('payment_method_catalog', {
    id: model.id({ prefix: 'pmc' }).primaryKey(),
    provider_code: model.text().default('mercadopago'),
    // id de MP: "visa", "master", "account_money", "pagofacil", ...
    external_id: model.text(),
    name: model.text(),
    // credit_card | debit_card | ticket | account_money | bank_transfer | ...
    payment_type_id: model.text().nullable(),
    status: model.text().nullable(),
    thumbnail_url: model.text().nullable(),
    min_allowed_amount: model.number().nullable(),
    max_allowed_amount: model.number().nullable(),
    // Máx. de cuotas sin interés observadas en el snapshot (installment_rate===0).
    max_interest_free_installments: model.number().nullable(),
    // Respuesta cruda del proveedor (para trazabilidad / debug).
    raw: model.json().nullable(),
    last_synced_at: model.dateTime().nullable(),
    /**
     * La tienda cuya cuenta del proveedor produjo este catálogo. `NULL` = GLOBAL, el
     * sincronizado con las credenciales de entorno.
     *
     * Importa desde que las credenciales de MercadoPago son por tienda: dos tiendas con
     * cuentas distintas pueden tener medios de pago distintos habilitados, y mostrar el
     * catálogo de una en la otra le ofrece al comprador un medio que su checkout va a
     * rechazar.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    // DOS parciales: en Postgres `NULL != NULL`.
    {
      on: ['provider_code', 'external_id'],
      unique: true,
      where: 'site_id IS NULL AND deleted_at IS NULL',
    },
    {
      on: ['site_id', 'provider_code', 'external_id'],
      unique: true,
      where: 'site_id IS NOT NULL AND deleted_at IS NULL',
    },
    { on: ['site_id'] },
  ]);

export default PaymentMethodCatalog;
