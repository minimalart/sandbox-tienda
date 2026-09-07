import type { PaymentBenefitProvider } from './types';
/**
 * Adapter de Mercado Pago. Sincroniza SOLO lo que la API pública de MP expone
 * de forma verificable:
 *  - medios de pago  → GET /v1/payment_methods
 *  - cuotas sin interés (snapshot) → GET /v1/payment_methods/installments
 *
 * Descuentos / reintegros / promos bancarias NO tienen endpoint público de
 * lectura → se cargan manualmente (adapter `manual`).
 */
export declare const mercadoPagoAdapter: PaymentBenefitProvider;
