/**
 * Beneficios de Pago. Muestra en storefront/backoffice los beneficios asociados
 * a los medios de pago (cuotas, descuentos, reintegros, promos bancarias/wallet).
 *
 * A diferencia de las Promotions comerciales de Medusa (que mueven el precio),
 * estos beneficios son INFORMATIVOS: nunca modifican el precio del producto.
 *
 * Origen de los datos (validado contra la API de Mercado Pago):
 *  - medios de pago  → GET /v1/payment_methods            (sync)
 *  - cuotas          → GET /v1/payment_methods/installments (sync, snapshot por monto)
 *  - descuentos / reintegros / cashback / promos bancarias → MANUAL (MP no los
 *    expone por API pública de lectura para terceros).
 */
export declare const PAYMENT_BENEFITS_MODULE = "payment_benefits";
/** Código del proveedor de pago que origina el beneficio. */
export type PaymentProviderCode = 'mercadopago' | 'modo' | 'payway' | 'stripe' | 'todopago' | 'manual' | 'otro';
/** Tipo de beneficio (PRD §7). */
export type BenefitType = 'installments' | 'percentage_discount' | 'fixed_discount' | 'refund' | 'cashback' | 'custom';
/** Origen del dato: `manual` es editable; los sync son de solo lectura. */
export type BenefitSource = 'manual' | 'mercadopago' | 'modo' | 'payway' | 'stripe' | 'otro';
/** Estado del beneficio (PRD §10). */
export type BenefitStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' | 'sync_error';
/** Alcance de aplicabilidad (PRD §6, Payment Eligibility). */
export type EligibilityScope = 'global' | 'collection' | 'category' | 'brand' | 'product';
/** Dónde aplica el beneficio. `ids` vacío + scope `global` → aplica a todo. */
export type BenefitEligibility = {
    scope: EligibilityScope;
    ids: string[];
};
/** Restricciones del beneficio (PRD §6, Payment Conditions). */
export type BenefitConditions = {
    card_brand?: string | null;
    issuer?: string | null;
    payment_method?: string | null;
    wallet?: string | null;
    country?: string | null;
    currency?: string | null;
};
/** Resultado de una corrida de sincronización de un proveedor. */
export type SyncResult = {
    provider_code: PaymentProviderCode;
    status: 'ok' | 'error';
    items_synced: number;
    message?: string | null;
};
