import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { getRecommendationsConfig, recommendationsEnvEnabled } from '../modules/recommendations/config';
import {
  classifyAttribution,
  groupTimelineByProduct,
  type TimelineEvent,
} from '../modules/recommendations/events/attribution';
import { insertEventRows } from '../modules/recommendations/events/record';
import { resolveSite } from '../lib/multistore/resolve-site';

/**
 * Atribuye compras a recomendaciones (PRD §14.3/§14.4).
 *
 * El evento `purchased` lo escribe SIEMPRE el servidor, nunca el cliente: aceptarlo del
 * storefront permitiría inventar compras y revenue.
 *
 * Este es el séptimo subscriber de `order.placed` en el proyecto, y corre en un
 * contenedor de 1 vCPU compartido con el HTTP server. Por eso el orden de los chequeos
 * está pensado para salir lo antes posible: kill switch, después UNA query indexada por
 * `(cart_id, event)` que devuelve vacío para la enorme mayoría de las órdenes, y sólo si
 * hay timeline se hace el trabajo real.
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CART_LINK_RETRIES = 5;
const CART_LINK_DELAY_MS = 500;

type KnexLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

export default async function recommendationOrderAttribution({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderId = data?.id;

  if (!orderId || !recommendationsEnvEnabled()) return;

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const loadOrder = async () => {
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: [
          'id',
          'cart_id',
          'customer_id',
          'sales_channel_id',
          'currency_code',
          'items.product_id',
          'items.quantity',
          'items.total',
          'summary.totals',
        ],
        filters: { id: orderId },
      });
      return orders[0] as
        | {
            id: string;
            cart_id?: string | null;
            customer_id?: string | null;
            sales_channel_id?: string | null;
            currency_code?: string | null;
            items?: Array<{ product_id?: string | null; quantity?: number; total?: number }> | null;
            summary?: { totals?: Record<string, unknown> } | null;
          }
        | undefined;
    };

    // El link order → cart NO está commiteado cuando se emite `order.placed`: se crea en
    // un paso posterior de completeCartWorkflow. Toda la atribución se busca por
    // `cart_id`, así que sin este reintento acotado el subscriber funciona en desarrollo
    // y reporta CERO en producción. Mismo patrón que `order-company-tag.ts`.
    let order = await loadOrder();
    for (let attempt = 0; attempt < CART_LINK_RETRIES && !order?.cart_id; attempt++) {
      await sleep(CART_LINK_DELAY_MS);
      order = await loadOrder();
    }

    if (!order) return;

    // La tienda de la ORDEN, no la de la instancia.
    //
    // `admin/recommendations/config` es `scoped`: cada tienda elige su
    // `attribution_window_days`. Leer la fila global medía toda orden con la ventana
    // de la instancia, y el efecto es mudo en las dos direcciones — con una ventana
    // más corta que la propia se pierden compras atribuibles, con una más larga se
    // atribuyen clicks viejos. En ningún caso hay error: los números del dashboard
    // de la tienda simplemente no son los que su config dice.
    //
    // Sin `sales_channel_id` (órdenes viejas o canal borrado) queda `null` y se lee la
    // global, que es el comportamiento anterior. El costo es UNA query indexada más
    // por `order.placed`, despreciable al lado del retry con `sleep` de arriba.
    const resolution = order.sales_channel_id
      ? await resolveSite(container, { salesChannelId: order.sales_channel_id })
      : null;
    const siteId =
      resolution && (resolution.status === 'site' || resolution.status === 'singleSite')
        ? resolution.site.id
        : null;

    const config = await getRecommendationsConfig(container, siteId);
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

    // UNA query para todo el timeline. Es la que tiene que devolver vacío rápido.
    const windowStart = new Date(
      Date.now() - config.attribution_window_days * 24 * 60 * 60 * 1000,
    );

    const identifiers: Array<{ column: string; value: string }> = [];
    if (order.cart_id) identifiers.push({ column: 'cart_id', value: order.cart_id });
    if (order.customer_id) identifiers.push({ column: 'customer_id', value: order.customer_id });
    if (!identifiers.length) return;

    let timeline: TimelineEvent[] = [];
    // Del más específico al más laxo: el carrito identifica la sesión de compra exacta;
    // el cliente sólo se usa si el carrito no dio nada.
    for (const identifier of identifiers) {
      const result = await knex.raw(
        `select request_id, event, product_id, occurred_at, placement, strategy_key,
                resolved_strategy_key, version_id
         from "recommendation_event"
         where ${identifier.column} = ?
           and event in ('recommendation_served','recommendation_viewed','recommendation_clicked','recommendation_added_to_cart')
           and voided_at is null
           and deleted_at is null
           and occurred_at >= ?
         limit 500`,
        [identifier.value, windowStart],
      );
      const rows = (result?.rows ?? []) as TimelineEvent[];
      if (rows.length) {
        timeline = rows;
        break;
      }
    }

    // Caso común: la orden no tocó ninguna recomendación. Salida temprana.
    if (!timeline.length) return;

    const byProduct = groupTimelineByProduct(timeline);
    const orderTotal = Number(
      (order.summary?.totals as { current_order_total?: unknown })?.current_order_total ?? 0,
    );

    const rows: Array<Record<string, unknown>> = [];
    for (const item of order.items ?? []) {
      const productId = item.product_id;
      if (!productId) continue;

      const events = byProduct.get(productId);
      if (!events?.length) continue;

      const attribution = classifyAttribution(events);
      if (attribution.attribution === 'none') continue;

      rows.push({
        id: `recevt_${orderId.slice(-8)}_${productId.slice(-8)}_${attribution.attribution}`.slice(0, 60),
        request_id: attribution.request_id ?? '',
        event: 'recommendation_purchased',
        placement: attribution.placement,
        strategy_key: attribution.strategy_key,
        resolved_strategy_key: attribution.resolved_strategy_key,
        version_id: attribution.version_id,
        product_id: productId,
        served_product_ids: null,
        source_product_id: null,
        cart_id: order.cart_id ?? null,
        customer_id: order.customer_id ?? null,
        session_id: null,
        sales_channel_id: order.sales_channel_id ?? null,
        region_id: null,
        currency_code: order.currency_code ?? null,
        order_id: orderId,
        quantity: item.quantity ?? null,
        revenue: item.total ?? null,
        attribution: attribution.attribution,
        occurred_at: new Date(),
        // Idempotente por (orden, producto, placement): una re-entrega de `order.placed`
        // es no-op en lugar de duplicar revenue.
        idempotency_key: `purchased:${orderId}:${productId}:${attribution.placement ?? 'none'}`,
        // El total de la orden se guarda para el AOV de órdenes influenciadas; la
        // agregación deduplica a una fila por orden antes de sumarlo.
        metadata: orderTotal ? { order_total: orderTotal } : null,
      });
    }

    if (!rows.length) return;

    const inserted = await insertEventRows(container, rows as never);
    logger.info(
      `[recommendations] orden ${orderId}: ${inserted} producto(s) atribuido(s) a recomendaciones`,
    );
  } catch (error) {
    // Nunca se propaga: un fallo de atribución no puede impedir que la orden se procese.
    logger.error(
      `[recommendations] fallo la atribución de la orden ${orderId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
