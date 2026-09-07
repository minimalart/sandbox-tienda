"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodCatalog = void 0;
const utils_1 = require("@medusajs/framework/utils");
/**
 * Catálogo CRUDO de medios de pago sincronizado desde un proveedor (MP:
 * GET /v1/payment_methods + snapshot de cuotas sin interés vía
 * GET /v1/payment_methods/installments). Separado de `payment_benefit` para
 * distinguir el dato oficial del proveedor de los beneficios curados.
 *
 * Único por (provider_code, external_id) — se upsertea en cada sync.
 */
exports.PaymentMethodCatalog = utils_1.model
    .define('payment_method_catalog', {
    id: utils_1.model.id({ prefix: 'pmc' }).primaryKey(),
    provider_code: utils_1.model.text().default('mercadopago'),
    // id de MP: "visa", "master", "account_money", "pagofacil", ...
    external_id: utils_1.model.text(),
    name: utils_1.model.text(),
    // credit_card | debit_card | ticket | account_money | bank_transfer | ...
    payment_type_id: utils_1.model.text().nullable(),
    status: utils_1.model.text().nullable(),
    thumbnail_url: utils_1.model.text().nullable(),
    min_allowed_amount: utils_1.model.number().nullable(),
    max_allowed_amount: utils_1.model.number().nullable(),
    // Máx. de cuotas sin interés observadas en el snapshot (installment_rate===0).
    max_interest_free_installments: utils_1.model.number().nullable(),
    // Respuesta cruda del proveedor (para trazabilidad / debug).
    raw: utils_1.model.json().nullable(),
    last_synced_at: utils_1.model.dateTime().nullable(),
    /**
     * La tienda cuya cuenta del proveedor produjo este catálogo. `NULL` = GLOBAL, el
     * sincronizado con las credenciales de entorno.
     *
     * Importa desde que las credenciales de MercadoPago son por tienda: dos tiendas con
     * cuentas distintas pueden tener medios de pago distintos habilitados, y mostrar el
     * catálogo de una en la otra le ofrece al comprador un medio que su checkout va a
     * rechazar.
     */
    site_id: utils_1.model.text().nullable(),
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
exports.default = exports.PaymentMethodCatalog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF5bWVudC1tZXRob2QtY2F0YWxvZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL3BheW1lbnQtYmVuZWZpdHMvbW9kZWxzL3BheW1lbnQtbWV0aG9kLWNhdGFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRWxEOzs7Ozs7O0dBT0c7QUFDVSxRQUFBLG9CQUFvQixHQUFHLGFBQUs7S0FDdEMsTUFBTSxDQUFDLHdCQUF3QixFQUFFO0lBQ2hDLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzVDLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQztJQUNsRCxnRUFBZ0U7SUFDaEUsV0FBVyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDekIsSUFBSSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDbEIsMEVBQTBFO0lBQzFFLGVBQWUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3hDLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQy9CLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLGtCQUFrQixFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDN0Msa0JBQWtCLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QywrRUFBK0U7SUFDL0UsOEJBQThCLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN6RCw2REFBNkQ7SUFDN0QsR0FBRyxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDNUIsY0FBYyxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDM0M7Ozs7Ozs7O09BUUc7SUFDSCxPQUFPLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNqQyxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1AsNkNBQTZDO0lBQzdDO1FBQ0UsRUFBRSxFQUFFLENBQUMsZUFBZSxFQUFFLGFBQWEsQ0FBQztRQUNwQyxNQUFNLEVBQUUsSUFBSTtRQUNaLEtBQUssRUFBRSx3Q0FBd0M7S0FDaEQ7SUFDRDtRQUNFLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxlQUFlLEVBQUUsYUFBYSxDQUFDO1FBQy9DLE1BQU0sRUFBRSxJQUFJO1FBQ1osS0FBSyxFQUFFLDRDQUE0QztLQUNwRDtJQUNELEVBQUUsRUFBRSxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7Q0FDcEIsQ0FBQyxDQUFDO0FBRUwsa0JBQWUsNEJBQW9CLENBQUMifQ==