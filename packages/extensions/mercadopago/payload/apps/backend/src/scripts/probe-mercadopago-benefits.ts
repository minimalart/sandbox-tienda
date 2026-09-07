import { readMercadoPagoSetting } from '../modules/app-settings/mercadopago-runtime';
import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
/**
 * Constantes INLINEADAS acá a propósito. La versión canónica vive en
 * `@minimalart/mercatto-plugin-payment-benefits` (src/modules/payment-benefits/
 * constants.ts), pero este script es un probe operativo del host y no queremos
 * hacerlo dependiente del plugin cuando su único uso son estos tres literales.
 * Si alguna vez el probe crece y necesita el resto del módulo, migrarlo a un
 * exec del plugin y borrar esta copia.
 */
const MP_API_BASE = 'https://api.mercadopago.com';
const INSTALLMENTS_REFERENCE_AMOUNT = 10000;
const SAMPLE_BINS: Record<string, string> = {
  visa: '450799',
  master: '503175',
  amex: '371180',
  naranja: '589562',
  cabal: '604201',
  maestro: '501080',
};

/**
 * VALIDACIÓN EN VIVO de la API de Mercado Pago para Beneficios de Pago.
 *
 * Con MERCADOPAGO_ACCESS_TOKEN real, confirma que se pueden traer:
 *   1) medios de pago  → GET /v1/payment_methods
 *   2) cuotas / cuotas sin interés → GET /v1/payment_methods/installments
 * e imprime un resumen (incluye qué medios ofrecen cuotas sin interés).
 *
 * Uso:
 *   pnpm --filter @repo/backend exec medusa exec ./src/scripts/probe-mercadopago-benefits.ts
 */
export default async function probeMercadoPagoBenefits({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const token = readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN');

  if (!token) {
    logger.error('[probe-mp-benefits] Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.');
    return;
  }

  const mp = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${MP_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
    }
    return (await res.json()) as T;
  };

  // 1) Medios de pago.
  type Method = {
    id: string;
    name: string;
    payment_type_id?: string;
    status?: string;
    secure_thumbnail?: string;
  };
  const methods = await mp<Method[]>('/v1/payment_methods');
  logger.info(`[probe-mp-benefits] /v1/payment_methods → ${methods.length} medios de pago:`);
  for (const m of methods.slice(0, 30)) {
    logger.info(`   · ${m.id} — ${m.name} [${m.payment_type_id ?? '?'}] (${m.status ?? '?'})`);
  }

  // 2) Cuotas para un par de tarjetas de ejemplo.
  type Installments = {
    payment_method_id?: string;
    payer_costs?: Array<{
      installments?: number;
      installment_rate?: number;
      recommended_message?: string;
    }>;
  };
  for (const [pmId, bin] of Object.entries(SAMPLE_BINS)) {
    // Solo probamos los que existen en la cuenta.
    if (!methods.some((m) => m.id === pmId)) continue;
    try {
      const entries = await mp<Installments[]>(
        `/v1/payment_methods/installments?amount=${INSTALLMENTS_REFERENCE_AMOUNT}&payment_method_id=${pmId}&bin=${bin}`
      );
      const costs = entries[0]?.payer_costs ?? [];
      const free = costs.filter((c) => (c.installment_rate ?? 1) === 0).map((c) => c.installments);
      logger.info(
        `[probe-mp-benefits] installments ${pmId} (amount=${INSTALLMENTS_REFERENCE_AMOUNT}): ` +
          `${costs.length} planes; sin interés → [${free.join(', ') || 'ninguno'}]`
      );
      const sample = costs.find((c) => (c.installment_rate ?? 1) === 0) ?? costs[0];
      if (sample?.recommended_message) {
        logger.info(`   ej: "${sample.recommended_message}"`);
      }
    } catch (e) {
      logger.warn(
        `[probe-mp-benefits] installments ${pmId} falló: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  logger.info('[probe-mp-benefits] Listo. Confirma qué datos expone MP para esta cuenta.');
}
