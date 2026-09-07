import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ABANDONED_CART_MODULE } from '../modules/abandoned-cart';
import type AbandonedCartModuleService from '../modules/abandoned-cart/service';
import { detectionWindow, isWithinDetectionWindow } from '../modules/abandoned-cart/lib';
import { notifyAbandonedCartWorkflow } from '../workflows/notify-abandoned-cart';

type CartRow = {
  id: string;
  email?: string | null;
  completed_at?: string | Date | null;
  updated_at?: string | Date | null;
  total?: number | null;
  currency_code?: string | null;
  sales_channel_id?: string | null;
  customer_id?: string | null;
  items?: { id: string }[] | null;
  customer?: { phone?: string | null } | null;
  shipping_address?: { phone?: string | null } | null;
};

type QueryService = { graph: (i: unknown) => Promise<{ data: unknown[] }> };

type OrderRef = { id?: string | null } | null | undefined;
type CartOrderRow = {
  id: string;
  completed_at?: string | Date | null;
  /** El link cart→order declara `hasMany` del lado de Order: puede venir array. */
  order?: OrderRef | OrderRef[];
};

/** Normaliza `cart.order`, que según el link puede llegar como objeto o array. */
function orderIdOf(cart: CartOrderRow): string | null {
  const ref = Array.isArray(cart.order) ? cart.order[0] : cart.order;
  return ref?.id ?? null;
}

const CART_FIELDS = [
  'id',
  'email',
  'completed_at',
  'updated_at',
  'total',
  'currency_code',
  'sales_channel_id',
  'customer_id',
  'items.id',
  'customer.phone',
  'shipping_address.phone',
];

/**
 * Barrido periódico de carritos abandonados. Tres fases:
 *  1) DETECTAR: carritos `completed_at IS NULL` con items cuya última actividad
 *     cae DENTRO de la ventana (inactivos ≥ primer paso, no más viejos que
 *     `maxAgeHours`), y hace upsert del tracking. Se trackea tengan contacto o no:
 *     el contacto decide si se puede notificar, no si se mide.
 *  2) RECONCILIAR: cierra como `recovered` el tracking cuyo carrito ya se completó
 *     (red de seguridad para las órdenes cuyo evento se perdió).
 *  3) NOTIFICAR: dispara el workflow para cada tracking vencido (`next_eligible_at`).
 * Fire-and-forget: nunca propaga; cada error se loguea y sigue.
 */
export default async function scanAbandonedCartsJob(
  container: MedusaContainer,
): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<AbandonedCartModuleService>(ABANDONED_CART_MODULE);
  const query = container.resolve<QueryService>(ContainerRegistrationKeys.QUERY);

  const config = service.getConfig();
  if (!config.enabled) {
    logger.info('[AbandonedCart] cron: deshabilitado (ABANDONED_CART_ENABLED=false).');
    return;
  }

  const now = new Date();
  const window = detectionWindow(now, config);

  // ── Fase 1: detección ──────────────────────────────────────────────────────
  let detected = 0;
  let scanned = 0;
  let truncated = false;
  try {
    // La ventana se filtra en SQL, no en memoria. Filtrar después de paginar era
    // el bug original: con `order: updated_at ASC` y sin filtro, las primeras
    // páginas son los carritos abiertos más viejos de la tienda, todos fuera de
    // la ventana, y la corrida entera se consumía descartándolos.
    for (let page = 0; page < config.maxPages; page++) {
      const { data } = (await query.graph({
        entity: 'cart',
        fields: CART_FIELDS,
        filters: {
          completed_at: null,
          updated_at: { $gte: window.oldestAllowed, $lte: window.idleBefore },
        },
        pagination: {
          take: config.batchSize,
          skip: page * config.batchSize,
          // Dentro de la ventana, los más viejos primero: son los que están más
          // cerca de que se les cierre la ventana de recuperación.
          order: { updated_at: 'ASC' },
        },
      })) as { data: CartRow[] };

      scanned += data.length;

      for (const cart of data) {
        const updatedAt = cart.updated_at ? new Date(cart.updated_at) : null;
        // Redundante con el filtro SQL, cubre el borde de reloj entre el cálculo
        // de la ventana y la query.
        if (!updatedAt || !isWithinDetectionWindow(updatedAt, window)) continue;
        if (!cart.items || cart.items.length === 0) continue;

        try {
          await service.upsertFromSnapshot(
            {
              cart_id: cart.id,
              email: cart.email ?? null,
              phone:
                cart.customer?.phone ?? cart.shipping_address?.phone ?? null,
              customer_id: cart.customer_id ?? null,
              sales_channel_id: cart.sales_channel_id ?? null,
              cart_total: cart.total ?? null,
              currency_code: cart.currency_code ?? null,
              last_activity_at: updatedAt,
            },
            config,
          );
          detected++;
        } catch (e) {
          logger.warn(
            `[AbandonedCart] upsert de ${cart.id} falló: ${(e as Error).message}`,
          );
        }
      }

      if (data.length < config.batchSize) break;
      // Última página permitida y todavía venía llena: quedó ventana sin recorrer.
      if (page === config.maxPages - 1) truncated = true;
    }
  } catch (e) {
    logger.warn(`[AbandonedCart] detección falló: ${(e as Error).message}`);
  }

  // ── Fase 2: reconciliación de carritos ya convertidos ───────────────────────
  // El subscriber de `order.placed` reintenta el link order→cart, pero un reinicio
  // del proceso puede perder el evento. Sin esta pasada, esas filas quedan
  // `notified` para siempre y la tasa de recuperación queda subestimada.
  let reconciled = 0;
  try {
    reconciled = await reconcileCompletedCarts(service, query, config.batchSize, logger);
  } catch (e) {
    logger.warn(`[AbandonedCart] reconciliación falló: ${(e as Error).message}`);
  }

  // ── Fase 3: notificación de pasos vencidos ──────────────────────────────────
  let notified = 0;
  let failed = 0;
  try {
    const due = await service.listDue(now, config.batchSize);
    for (const record of due) {
      try {
        const { result } = await notifyAbandonedCartWorkflow(container).run({
          input: { abandonedCartId: record.id as string },
        });
        if (!(result as { skipped?: boolean }).skipped) notified++;
      } catch (e) {
        failed++;
        logger.warn(
          `[AbandonedCart] notificación de ${record.id} falló: ${(e as Error).message}`,
        );
      }
    }
  } catch (e) {
    logger.warn(`[AbandonedCart] barrido de vencidos falló: ${(e as Error).message}`);
  }

  // Se loguea SIEMPRE, incluso 0/0/0. El silencio cuando no había detecciones fue
  // la razón por la que la detección rota pasó meses sin que nadie la viera.
  logger.info(
    `[AbandonedCart] cron: ${scanned} carritos en ventana, ${detected} trackeados, ` +
      `${reconciled} reconciliados, ${notified} notificados, ${failed} con error. ` +
      `Ventana: ${window.oldestAllowed.toISOString()} → ${window.idleBefore.toISOString()}.`,
  );
  if (truncated) {
    logger.warn(
      `[AbandonedCart] tope de ${config.maxPages} páginas alcanzado: quedaron ` +
        `carritos en ventana sin revisar. Subí ABANDONED_CART_MAX_PAGES o ` +
        `ABANDONED_CART_BATCH_SIZE, o acortá ABANDONED_CART_MAX_AGE_HOURS.`,
    );
  }
}

/**
 * Marca `recovered` el tracking abierto cuyo carrito ya tiene `completed_at`.
 * Resuelve la orden por el link cart→order para no perder la atribución de valor.
 */
async function reconcileCompletedCarts(
  service: AbandonedCartModuleService,
  query: QueryService,
  batchSize: number,
  logger: Logger,
): Promise<number> {
  // Actividad más reciente primero: una conversión pasa poco después de la última
  // actividad del carrito, así que ahí es donde está lo que hay que reconciliar.
  // Ordenar al revés haría que la red de seguridad revise siempre las filas más
  // viejas — el mismo patrón de inanición que rompía la detección.
  const open = await service.listAbandonedCarts(
    { status: ['pending', 'notified'] },
    { take: batchSize, order: { last_activity_at: 'DESC' } },
  );
  if (!open.length) return 0;

  const { data } = (await query.graph({
    entity: 'cart',
    fields: ['id', 'completed_at', 'order.id'],
    filters: { id: open.map((r: { cart_id: string }) => r.cart_id) },
  })) as { data: CartOrderRow[] };

  const completed = new Map(
    data.filter((c) => c.completed_at).map((c) => [c.id, orderIdOf(c)]),
  );

  let reconciled = 0;
  for (const record of open as { id: string; cart_id: string }[]) {
    if (!completed.has(record.cart_id)) continue;
    const orderId = completed.get(record.cart_id) ?? null;
    if (await service.markRecoveredByCartId(record.cart_id, orderId)) {
      reconciled++;
      if (!orderId) {
        logger.warn(
          `[AbandonedCart] carrito ${record.cart_id} completado sin orden resoluble: ` +
            'se marca recuperado sin atribución de valor.',
        );
      }
    }
  }
  return reconciled;
}

export const config = {
  name: 'scan-abandoned-carts',
  schedule: process.env.ABANDONED_CART_SCAN_CRON || '*/15 * * * *',
};
