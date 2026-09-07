import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';
/**
 * Constantes de la extensión Beneficios de Pago.
 */

/** Base de la REST API de Mercado Pago (el SDK npm no envuelve estos GET). */
export const MP_API_BASE = 'https://api.mercadopago.com';

/**
 * Monto de referencia (unidad mayor, ARS) para el snapshot de cuotas. El
 * endpoint /v1/payment_methods/installments exige un `amount`; guardamos el
 * máximo de cuotas sin interés observado para este monto. Es aproximado — la
 * cifra exacta por precio queda para la fase 2 (consulta en vivo).
 */
export const INSTALLMENTS_REFERENCE_AMOUNT = 10000;

/**
 * BIN de ejemplo por medio de pago de tarjeta para poder consultar installments
 * (el endpoint acepta payment_method_id + bin). Son BINs públicos de prueba de
 * las marcas; solo se usan para descubrir el plan de cuotas del comercio.
 */
export const SAMPLE_BINS: Record<string, string> = {
  visa: '450799',
  master: '503175',
  amex: '371180',
  naranja: '589562',
  cabal: '604201',
  maestro: '501080',
};

/** ¿Está habilitado el sync con Mercado Pago? Reutiliza el token del provider. */
export function isMpBenefitsSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const saved =
    env === process.env
      ? getAppSettingsSyncReader()?.('extension:mercadopago', 'MERCADOPAGO_ACCESS_TOKEN')
      : undefined;
  return Boolean(saved || env.MERCADOPAGO_ACCESS_TOKEN);
}
