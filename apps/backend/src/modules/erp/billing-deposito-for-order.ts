import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  chosenStoreLocationId,
  deriveOrderBillingDeposito,
  readOrderBillingDeposito,
  type BillingDepositoDerivation,
  type BillingShippingMethod,
} from './billing-deposito';
import type { ErpConfigSettings } from './types';

/**
 * Junta de la base lo que las funciones puras de `billing-deposito.ts`
 * necesitan para decidir el depósito facturador de UNA orden, y devuelve el
 * depósito efectivo por orden.
 *
 * ── Por qué existe este archivo ──
 *
 * El PR #1203 dejó esta misma recolección adentro de
 * `subscribers/erp-order-billing-deposito.ts`, que corre en `order.placed` y
 * sella el resultado en `metadata.erp_billing_deposito`. Eso alcanza para el
 * trigger `fulfillment_created`, donde la factura sale mucho después.
 *
 * Con `payment_captured` —lo que tiene desdeelsur— NO alcanza, y por una razón
 * que no se ve leyendo un archivo solo: la venta la encola
 * `erp-order-placed-reconcile.ts`, que escucha **el mismo evento**
 * `order.placed` que el subscriber que escribe la metadata. Dos subscribers
 * sobre el mismo evento no tienen orden garantizado entre sí, y encima
 * `payment.captured` puede llegar antes que la orden exista. Leer la metadata
 * al encolar sería una carrera que perdemos la mitad de las veces, en silencio
 * y facturando desde el depósito equivocado.
 *
 * Por eso el camino del pago DERIVA el depósito en el momento de encolar, en
 * vez de esperar a que otro subscriber se lo haya dejado escrito. La metadata
 * sigue sellándose igual (sirve como override manual, para el admin y para la
 * auditoría), pero ya no es la fuente de verdad de la que depende la factura.
 *
 * ── Precedencia ──
 *
 * override manual de la orden → derivado de la sucursal de retiro → `null`,
 * que el adapter resuelve como "usá el depósito de la configuración".
 */
export type OrderBillingDepositoLookup = {
  /** Depósito efectivo de esta orden. `null` = que decida la config del provider. */
  deposito: string | null;
  /** De dónde salió. Se loguea; sirve para entender una factura después. */
  source: 'order_override' | 'store_pickup' | null;
  /** Por qué no se derivó, cuando no se derivó. */
  derivation: BillingDepositoDerivation;
  /** Sucursal elegida por el comprador, si eligió alguna. */
  storeId: string | null;
};

/**
 * `null` cuando la orden no existe. NUNCA lanza por una sucursal borrada o por
 * la extensión de sucursales ausente: en ese caso devuelve `deposito: null` y
 * la orden factura desde la config, que es exactamente lo que pasaba antes de
 * este cambio.
 */
export async function lookupOrderBillingDeposito(
  container: MedusaContainer,
  opts: { orderId: string; settings: ErpConfigSettings | null | undefined }
): Promise<OrderBillingDepositoLookup | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: ['id', 'metadata', 'shipping_methods.data'],
    filters: { id: opts.orderId },
  })) as {
    data: Array<{
      id: string;
      metadata?: Record<string, unknown> | null;
      shipping_methods?: BillingShippingMethod[] | null;
    }>;
  };

  const order = orders[0];
  if (!order) return null;

  const shippingMethods = order.shipping_methods ?? [];
  const storeId = chosenStoreLocationId(order.metadata, shippingMethods);

  /*
   * La stock location de la sucursal se lee por el GRAFO y no resolviendo el
   * módulo `store-location`, aunque importarlo sería más directo.
   *
   * Motivo: `resolveOwnership` del composer atribuye cada archivo a la
   * extensión cuyos módulos importa, y uno que importa DOS extensiones sin
   * relación de dependencia se cae del payload **en silencio** — en una
   * instalación nueva este archivo simplemente no existiría, sin ningún error
   * que lo delate. Ya pasó con `erp-invoice-ready-email.ts`.
   *
   * Por el grafo no hay import: si la extensión de sucursales no está
   * instalada, la consulta falla y se cae al catch, que es exactamente el
   * comportamiento que queremos (sin sucursales no hay retiro en tienda).
   *
   * `stock_location_id` es nullable: una sucursal recién creada puede no
   * tenerla todavía, y ahí no hay nada que derivar.
   */
  let storeStockLocationId: string | null = null;
  if (storeId) {
    try {
      const { data: branches } = (await query.graph({
        entity: 'store_location',
        fields: ['id', 'stock_location_id'],
        filters: { id: storeId },
      })) as { data: Array<{ stock_location_id?: string | null }> };
      storeStockLocationId = branches[0]?.stock_location_id ?? null;
    } catch {
      storeStockLocationId = null; // sucursal borrada o extensión ausente
    }
  }

  const derivation = deriveOrderBillingDeposito({
    settings: opts.settings,
    orderMetadata: order.metadata,
    shippingMethods,
    storeStockLocationId,
  });

  const override = readOrderBillingDeposito(order.metadata);
  if (override) {
    return { deposito: override, source: 'order_override', derivation, storeId };
  }
  if (derivation.kind === 'derived') {
    return { deposito: derivation.deposito, source: 'store_pickup', derivation, storeId };
  }
  return { deposito: null, source: null, derivation, storeId };
}
