import type {
  ErpBillingConfirmation,
  ErpConfigSettings,
  ErpDepositoMapping,
  ErpSalesTrigger,
} from './types';
import { DEFAULT_SALES_NOTIFY_SETTINGS } from './types';

/**
 * Resolución del DEPÓSITO FACTURADOR: el depósito del ERP desde el que se
 * emite el comprobante de una orden.
 *
 * Funciones puras a propósito — las consumen el gate de fulfillment
 * (`api/admin/erp/fulfillment-gate.ts`), el subscriber de
 * `order.fulfillment_created` y la validación de la config, y las tres tienen
 * que coincidir exactamente. Si esto divergiera, el gate aceptaría un
 * fulfillment desde una location y el payload facturaría desde otra.
 */

/** Trigger efectivo. Default `payment_captured`: nunca cambiar lo ya instalado. */
export function resolveSalesTrigger(
  settings: ErpConfigSettings | null | undefined
): ErpSalesTrigger {
  return settings?.sales_notify?.trigger ?? DEFAULT_SALES_NOTIFY_SETTINGS.trigger;
}

/** Filas del mapeo de depósitos que están activas. */
export function activeDepositoMappings(
  settings: ErpConfigSettings | null | undefined
): ErpDepositoMapping[] {
  return (settings?.stock_sync?.deposito_map ?? []).filter(
    (row) => row.enabled !== false && Boolean(row.deposito) && Boolean(row.stock_location_id)
  );
}

/** El mapeo de un código de depósito, o `null` si no está mapeado/activo. */
export function findDepositoMapping(
  settings: ErpConfigSettings | null | undefined,
  deposito: string | null | undefined
): ErpDepositoMapping | null {
  if (!deposito) return null;
  return activeDepositoMappings(settings).find((row) => row.deposito === deposito) ?? null;
}

/** Lo que la orden trae en `metadata` sobre facturación (lo escribe el gate). */
export type OrderBillingMetadata = {
  /** Override manual del depósito facturador para esta orden. */
  erp_billing_deposito?: unknown;
  /** Marca del gate: un humano confirmó el depósito desde el admin. */
  erp_billing?: unknown;
};

/** Lee el override por orden, tolerante a metadata sucia. */
export function readOrderBillingDeposito(
  metadata: OrderBillingMetadata | null | undefined
): string | null {
  const value = metadata?.erp_billing_deposito;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Lee la marca del gate. Devuelve `null` cuando falta o está incompleta: sin
 * marca válida NO se factura, y eso es lo que filtra los fulfillments creados
 * por el auto-fulfill de un carrier (que nunca pasan por la ruta admin).
 */
export function readBillingConfirmation(
  metadata: OrderBillingMetadata | null | undefined
): ErpBillingConfirmation | null {
  const raw = metadata?.erp_billing;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const deposito = value.deposito;
  const stockLocationId = value.stock_location_id;
  const confirmedAt = value.confirmed_at;
  if (typeof deposito !== 'string' || deposito.length === 0) return null;
  if (typeof stockLocationId !== 'string' || stockLocationId.length === 0) return null;
  if (typeof confirmedAt !== 'string' || confirmedAt.length === 0) return null;
  return {
    deposito,
    stock_location_id: stockLocationId,
    confirmed_at: confirmedAt,
    confirmed_by: typeof value.confirmed_by === 'string' ? value.confirmed_by : null,
  };
}

export type BillingDepositoResolution =
  | { ok: true; deposito: string; stock_location_id: string; source: 'order' | 'config' }
  | { ok: false; reason: 'not_configured' | 'not_mapped'; deposito: string | null };

/**
 * Depósito facturador efectivo de una orden.
 *
 * Precedencia: override de la orden → default de la config. El
 * `zeus.deposito_id` NO participa: es un `number` del espacio de la config del
 * provider y no está mapeado a ninguna stock location, así que no sirve para
 * validar desde qué location se puede despachar. Si no hay depósito facturador
 * mapeado, el gate corta con un mensaje que apunta a Configuración — mejor eso
 * que facturar desde un depósito que nadie eligió.
 */
export function resolveBillingDeposito(
  settings: ErpConfigSettings | null | undefined,
  orderMetadata?: OrderBillingMetadata | null
): BillingDepositoResolution {
  const override = readOrderBillingDeposito(orderMetadata);
  const configured = settings?.sales_notify?.billing_deposito ?? null;
  const deposito = override ?? configured;
  if (!deposito) return { ok: false, reason: 'not_configured', deposito: null };
  const mapping = findDepositoMapping(settings, deposito);
  if (!mapping) return { ok: false, reason: 'not_mapped', deposito };
  return {
    ok: true,
    deposito: mapping.deposito,
    stock_location_id: mapping.stock_location_id!,
    source: override ? 'order' : 'config',
  };
}
