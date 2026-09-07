/**
 * Constantes de la extensión Beneficios de Pago.
 */
/** Base de la REST API de Mercado Pago (el SDK npm no envuelve estos GET). */
export declare const MP_API_BASE = "https://api.mercadopago.com";
/**
 * Monto de referencia (unidad mayor, ARS) para el snapshot de cuotas. El
 * endpoint /v1/payment_methods/installments exige un `amount`; guardamos el
 * máximo de cuotas sin interés observado para este monto. Es aproximado — la
 * cifra exacta por precio queda para la fase 2 (consulta en vivo).
 */
export declare const INSTALLMENTS_REFERENCE_AMOUNT = 10000;
/**
 * BIN de ejemplo por medio de pago de tarjeta para poder consultar installments
 * (el endpoint acepta payment_method_id + bin). Son BINs públicos de prueba de
 * las marcas; solo se usan para descubrir el plan de cuotas del comercio.
 */
export declare const SAMPLE_BINS: Record<string, string>;
/** ¿Está habilitado el sync con Mercado Pago? Reutiliza el token del provider. */
export declare function isMpBenefitsSyncEnabled(env?: NodeJS.ProcessEnv): boolean;
