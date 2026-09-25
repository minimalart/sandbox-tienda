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

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Depósito facturador DERIVADO DE LA SUCURSAL QUE ELIGIÓ EL COMPRADOR
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Regla de negocio (DESDEELSUR-61): en retiro en tienda factura la sucursal
 * donde la persona va a retirar. Es lo que pasa en el mostrador — vas a una
 * sucursal y te factura ésa — y evita que el depósito facturador sea una
 * constante que no se corresponde con la operación real.
 *
 * NO cubre el envío a domicilio, y es a propósito: ahí el comprador no elige
 * ninguna sucursal, así que no hay nada que derivar. Esos pedidos siguen
 * cayendo al depósito de la configuración, que por eso no sobra.
 *
 * Todo lo que sigue es puro. Quien junta los datos es
 * `subscribers/erp-order-billing-deposito.ts`.
 */

/** Dato mínimo de una shipping method para decidir si el pedido es retiro. */
export type BillingShippingMethod = {
  data?: Record<string, unknown> | null;
};

const readString = (source: unknown, key: string): string | null => {
  if (typeof source !== 'object' || source === null) return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

/**
 * ¿El pedido es retiro EN SUCURSAL NUESTRA?
 *
 * `pickup_kind` distingue tres cosas que en el checkout se parecen: `store`
 * (nuestras sucursales), `carrier` (sucursal de Andreani o Correo, que no es
 * nuestra y no factura nada) y el envío a domicilio, que no lo trae. Sin este
 * filtro, un retiro en sucursal de Correo derivaría un depósito facturador que
 * no existe.
 */
export function isStorePickup(shippingMethods: BillingShippingMethod[]): boolean {
  return shippingMethods.some((method) => readString(method?.data, 'pickup_kind') === 'store');
}

/**
 * Sucursal elegida por el comprador.
 *
 * DUPLICADO A PROPÓSITO de `modules/email/pickup-context.ts`
 * (`chosenStoreLocationId`) y de `workflows/create-delivery-execution.ts`: son
 * cinco líneas contra un acople entre extensiones. `erp` no puede importar de
 * `email-templates` ni de `delivery` — cualquiera de las tres puede no estar
 * instalada.
 *
 * Que se descarte el string vacío no es un detalle: al cambiar de modo de
 * entrega el storefront LIMPIA el campo escribiendo `store_id: ''` en vez de
 * borrarlo, así que un `''` significa "no eligió", no un id.
 */
export function chosenStoreLocationId(
  orderMetadata: unknown,
  shippingMethods: BillingShippingMethod[]
): string | null {
  return (
    readString(orderMetadata, 'store_id') ??
    shippingMethods.map((m) => readString(m?.data, 'store_id')).find((v) => Boolean(v)) ??
    null
  );
}

/** Depósito del ERP mapeado a una stock location, o null si esa location no está mapeada. */
export function depositoForStockLocation(
  settings: ErpConfigSettings | null | undefined,
  stockLocationId: string | null | undefined
): string | null {
  if (!stockLocationId) return null;
  return (
    activeDepositoMappings(settings).find((row) => row.stock_location_id === stockLocationId)
      ?.deposito ?? null
  );
}

/** Por qué no se derivó un depósito. Se loguea; nada de esto es un error. */
export type BillingDepositoDerivation =
  | { kind: 'derived'; deposito: string }
  | { kind: 'skip'; reason: 'already_set' | 'not_store_pickup' | 'no_store' | 'no_location' | 'not_mapped' };

/**
 * Decide qué depósito facturador le corresponde a una orden por su sucursal de
 * retiro.
 *
 * `storeStockLocationId` es el `stock_location_id` de la sucursal elegida, que
 * el subscriber resuelve contra el módulo `store-location`.
 *
 * Un override ya escrito NO se pisa: si alguien lo puso a mano para esa orden,
 * gana sobre cualquier derivación automática.
 */
export function deriveOrderBillingDeposito(input: {
  settings: ErpConfigSettings | null | undefined;
  orderMetadata: OrderBillingMetadata | null | undefined;
  shippingMethods: BillingShippingMethod[];
  storeStockLocationId: string | null | undefined;
}): BillingDepositoDerivation {
  if (readOrderBillingDeposito(input.orderMetadata)) return { kind: 'skip', reason: 'already_set' };
  if (!isStorePickup(input.shippingMethods)) return { kind: 'skip', reason: 'not_store_pickup' };
  if (!chosenStoreLocationId(input.orderMetadata, input.shippingMethods)) {
    return { kind: 'skip', reason: 'no_store' };
  }
  if (!input.storeStockLocationId) return { kind: 'skip', reason: 'no_location' };

  const deposito = depositoForStockLocation(input.settings, input.storeStockLocationId);
  if (!deposito) return { kind: 'skip', reason: 'not_mapped' };
  return { kind: 'derived', deposito };
}
