import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';
import { LOYALTY_MODULE } from '../modules/loyalty';
import type LoyaltyModuleService from '../modules/loyalty/service';
import { earnLoyaltyPointsWorkflow } from '../workflows/earn-loyalty-points';
import { resolvePointsEarnRate } from '../modules/loyalty/settings';

type OrderGraphResult = {
  id: string;
  customer_id: string | null;
  item_total: number;
  metadata: { context?: string } | null;
  sales_channel: { id?: string; metadata: { channel_type?: string } | null } | null;
  items: Array<{
    total: number;
    product?: {
      is_giftcard?: boolean;
      collection_id?: string | null;
      categories?: Array<{ id: string }> | null;
    } | null;
  }>;
};

export default async function handlePointsOrderPlaced({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: [
      'id', 'customer_id', 'item_total', 'metadata',
      'sales_channel.id', 'sales_channel.metadata',
      'items.total', 'items.product.is_giftcard',
      'items.product.collection_id', 'items.product.categories.id',
    ],
    filters: { id: orderId },
  })) as { data: OrderGraphResult[] };

  const order = orders[0];
  // Guest checkout (no customer) → no points to earn.
  if (!order || !order.customer_id) return;

  // Points are a B2C-only benefit. Skip B2B orders (mayorista).
  const channelType = order.sales_channel?.metadata?.channel_type;
  const context = order.metadata?.context;
  if (channelType === 'b2b' || context === 'b2b') {
    logger.info(`[Loyalty] Skipping B2B order ${order.id} — points are B2C-only.`);
    return;
  }

  // Gift cards move value rather than create eligible merchandise revenue.
  const eligibleItems = (order.items ?? []).filter((item) => item.product?.is_giftcard !== true);
  const amount = eligibleItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  if (amount <= 0) return;

  const categoryIds = [
    ...new Set(
      eligibleItems.flatMap((i) => (i.product?.categories ?? []).map((c) => c.id)).filter(Boolean),
    ),
  ];
  const collectionIds = [
    ...new Set(eligibleItems.map((i) => i.product?.collection_id).filter((id): id is string => !!id)),
  ];

  try {
    const loyalty = container.resolve<LoyaltyModuleService>(LOYALTY_MODULE);
    const program = await loyalty.getActiveProgram();

    if (program) {
      // Rule-based earning (Loyalty Engine).
      const { result } = await earnLoyaltyPointsWorkflow(container).run({
        input: {
          customer_id: order.customer_id,
          event: 'purchase',
          amount,
          reference: 'order',
          reference_id: order.id,
          sales_channel_id: order.sales_channel?.id ?? null,
          category_ids: categoryIds,
          collection_ids: collectionIds,
        },
      });
      const total = (result?.awarded ?? []).reduce((s, a) => s + a.points, 0);
      logger.info(`[Loyalty] Order ${order.id}: awarded ${total} points from ${result?.awarded?.length ?? 0} rule(s).`);
      return;
    }

    // Legacy fallback: no program seeded → tasa configurable (Fase 1 behavior).
    //
    // Se resuelve ACÁ y no en un `const` de módulo, que es como estaba: la card
    // del admin cambia la tasa en caliente y una constante de import la
    // congelaría hasta el próximo reinicio. `resolvePointsEarnRate` además sanea
    // el valor — antes esta línea aceptaba un `NaN` del entorno y acreditaba
    // `Math.floor(NaN)`, mientras que `scripts/seed-loyalty.ts` sí exigía `> 0`:
    // dos criterios distintos para el mismo número.
    const points = container.resolve<PointsModuleService>(POINTS_MODULE);
    const legacyPoints = Math.floor(amount * resolvePointsEarnRate());
    if (legacyPoints > 0) {
      await points.earnPoints(order.customer_id, legacyPoints, {
        reference: 'order',
        reference_id: order.id,
        idempotency_key: `earn:order:${order.id}`,
      });
      logger.info(`[Loyalty] Order ${order.id}: awarded ${legacyPoints} points (legacy rate, no program seeded).`);
    }
  } catch (error) {
    logger.error(`[Loyalty] Failed to earn points for order ${order.id}: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
