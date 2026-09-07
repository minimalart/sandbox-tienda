import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from '.';
import type RecurringOrderModuleService from './service';
import { getAdminNotificationEmail } from '../email/admin-recipient';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionDemandRow = {
  variant_id: string;
  sales_channel_id: string;
  location_id: string | null;
  location_name: string | null;
  required_14d: number;
  required_30d: number;
  available: number;
  deficit_14d: number;
  deficit_30d: number;
  recurring_order_ids: string[];
  next_due_at: string | null;
};

type DemandInput = {
  variant_id: string;
  quantity: number;
  sales_channel_id: string;
  location_id?: string | null;
  location_name?: string | null;
  recurring_order_id: string;
  scheduled_at: Date | string;
};

/** Agregador puro: se prueba sin Medusa ni inventario. */
export function aggregateSubscriptionDemand(
  input: DemandInput[],
  availableByVariant: Map<string, number>,
  now: Date,
): SubscriptionDemandRow[] {
  const byKey = new Map<string, SubscriptionDemandRow>();
  const cutoff14 = now.getTime() + 14 * DAY_MS;
  const cutoff30 = now.getTime() + 30 * DAY_MS;
  for (const line of input) {
    const due = new Date(line.scheduled_at).getTime();
    if (!Number.isFinite(due) || due < now.getTime() || due > cutoff30) continue;
    const locationId = line.location_id ?? null;
    const key = `${line.sales_channel_id}:${locationId ?? 'unassigned'}:${line.variant_id}`;
    const row = byKey.get(key) ?? {
      variant_id: line.variant_id,
      sales_channel_id: line.sales_channel_id,
      location_id: locationId,
      location_name: line.location_name ?? null,
      required_14d: 0,
      required_30d: 0,
      available: locationId
        ? (availableByVariant.get(`${locationId}:${line.variant_id}`) ?? 0)
        : (availableByVariant.get(line.variant_id) ?? 0),
      deficit_14d: 0,
      deficit_30d: 0,
      recurring_order_ids: [],
      next_due_at: null,
    };
    row.required_30d += line.quantity;
    if (due <= cutoff14) row.required_14d += line.quantity;
    if (!row.recurring_order_ids.includes(line.recurring_order_id)) {
      row.recurring_order_ids.push(line.recurring_order_id);
    }
    if (!row.next_due_at || due < new Date(row.next_due_at).getTime()) {
      row.next_due_at = new Date(due).toISOString();
    }
    byKey.set(key, row);
  }
  for (const row of byKey.values()) {
    row.deficit_14d = Math.max(0, row.required_14d - row.available);
    row.deficit_30d = Math.max(0, row.required_30d - row.available);
  }
  return [...byKey.values()].sort(
    (a, b) => b.deficit_14d - a.deficit_14d || b.deficit_30d - a.deficit_30d,
  );
}

/**
 * Demanda comprometida contra stock real (stocked - reserved) para 14/30 días.
 * Sólo cuenta suscripciones activas y ciclos todavía abiertos.
 */
export async function buildSubscriptionForecast(
  container: MedusaContainer,
  now: Date = new Date(),
): Promise<SubscriptionDemandRow[]> {
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: any[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const cycles = await service.listRenewalCycles(
    {
      // Los ciclos reservados ya están descontados de `available` por Medusa.
      // Contarlos otra vez como demanda duplicaría su impacto en el forecast.
      status: ['scheduled', 'retrying_stock'],
      scheduled_at: {
        $gte: now,
        $lte: new Date(now.getTime() + 30 * DAY_MS),
      },
      recurring_order: { status: 'active' },
    },
    { take: 10_000, order: { scheduled_at: 'ASC' } },
  );
  if (!cycles.length) return [];

  const orderIds = [...new Set(cycles.map((cycle: any) => cycle.recurring_order_id))];
  const orders = await service.listRecurringOrders(
    { id: orderIds },
    { take: orderIds.length, relations: ['items'] },
  );
  const orderById = new Map(orders.map((order: any) => [order.id, order]));
  const shippingOptionIds = [
    ...new Set(orders.map((order: any) => order.shipping_option_id).filter(Boolean)),
  ] as string[];
  const locationByShippingOption = new Map<
    string,
    { id: string; name: string | null }
  >();
  if (shippingOptionIds.length) {
    const { data: shippingOptions } = await query.graph({
      entity: 'shipping_option',
      fields: [
        'id',
        'service_zone.fulfillment_set.location.id',
        'service_zone.fulfillment_set.location.name',
      ],
      filters: { id: shippingOptionIds },
    });
    for (const option of shippingOptions) {
      const location = option.service_zone?.fulfillment_set?.location;
      if (location?.id) {
        locationByShippingOption.set(option.id, {
          id: location.id,
          name: location.name ?? null,
        });
      }
    }
  }
  const demand: DemandInput[] = [];
  for (const cycle of cycles) {
    const order: any = orderById.get(cycle.recurring_order_id);
    if (!order) continue;
    const location = order.shipping_option_id
      ? locationByShippingOption.get(order.shipping_option_id)
      : undefined;
    for (const item of order.items ?? []) {
      demand.push({
        variant_id: item.variant_id,
        quantity: Number(item.quantity) || 0,
        sales_channel_id: order.sales_channel_id,
        location_id: location?.id ?? null,
        location_name: location?.name ?? null,
        recurring_order_id: order.id,
        scheduled_at: cycle.scheduled_at,
      });
    }
  }

  const variantIds = [...new Set(demand.map((line) => line.variant_id))];
  const availableByVariant = new Map<string, number>();
  if (variantIds.length) {
    const { data: variants } = await query.graph({
      entity: 'product_variant',
      fields: ['id', 'inventory_items.inventory_item_id'],
      filters: { id: variantIds },
    });
    const inventoryToVariant = new Map<string, string>();
    for (const variant of variants) {
      for (const item of variant.inventory_items ?? []) {
        if (item.inventory_item_id) inventoryToVariant.set(item.inventory_item_id, variant.id);
      }
    }
    if (inventoryToVariant.size) {
      const { data: levels } = await query.graph({
        entity: 'inventory_level',
        fields: ['inventory_item_id', 'location_id', 'stocked_quantity', 'reserved_quantity'],
        filters: { inventory_item_id: [...inventoryToVariant.keys()] },
      });
      for (const level of levels) {
        const variantId = inventoryToVariant.get(level.inventory_item_id);
        if (!variantId) continue;
        const available =
          (Number(level.stocked_quantity) || 0) - (Number(level.reserved_quantity) || 0);
        const safeAvailable = Math.max(0, available);
        availableByVariant.set(
          variantId,
          (availableByVariant.get(variantId) ?? 0) + safeAvailable,
        );
        if (level.location_id) {
          const locationKey = `${level.location_id}:${variantId}`;
          availableByVariant.set(
            locationKey,
            (availableByVariant.get(locationKey) ?? 0) + safeAvailable,
          );
        }
      }
    }
  }
  return aggregateSubscriptionDemand(demand, availableByVariant, now);
}

export async function refreshSubscriptionStockAlerts(
  container: MedusaContainer,
  now: Date = new Date(),
): Promise<SubscriptionDemandRow[]> {
  const service = container.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const rows = await buildSubscriptionForecast(container, now);
  const activeKeys = new Set<string>();
  for (const row of rows) {
    const key = `forecast-stock:${row.sales_channel_id}:${row.location_id ?? 'unassigned'}:${row.variant_id}`;
    if (row.deficit_14d > 0 || row.deficit_30d > 0) {
      activeKeys.add(key);
      const [previous] = await service.listSubscriptionAlerts(
        { dedupe_key: key },
        { take: 1 },
      );
      const alert = await service.upsertAlert({
        dedupe_key: key,
        sales_channel_id: row.sales_channel_id,
        variant_id: row.variant_id,
        type: 'stock_forecast',
        severity: row.deficit_14d > 0 ? 'critical' : 'warning',
        title: 'Stock insuficiente para renovaciones futuras',
        message: `${row.required_14d} unidades comprometidas a 14 días y ${row.available} disponibles.`,
        data: row as unknown as Record<string, unknown>,
      });
      const recipient = await getAdminNotificationEmail(container, {
        salesChannelId: row.sales_channel_id,
      });
      if (recipient && previous?.status !== 'open') {
        await service.enqueueNotification({
          dedupe_key: `forecast-stock-admin:${alert.id}:${new Date(alert.detected_at).toISOString()}`,
          sales_channel_id: row.sales_channel_id,
          channel: 'email',
          recipient,
          template: 'recurring-stock-alert',
          data: {
            sales_channel_id: row.sales_channel_id,
            variant_id: row.variant_id,
            location_id: row.location_id,
            location_name: row.location_name,
            required_14d: row.required_14d,
            required_30d: row.required_30d,
            available: row.available,
            deficit_14d: row.deficit_14d,
            deficit_30d: row.deficit_30d,
            affected_subscriptions: row.recurring_order_ids.length,
          },
        });
      }
    } else {
      await service.resolveAlert(key, now);
    }
  }
  const openForecastAlerts = await service.listSubscriptionAlerts(
    { type: 'stock_forecast', status: 'open' },
    { take: 10_000 },
  );
  for (const alert of openForecastAlerts) {
    if (!activeKeys.has(alert.dedupe_key)) {
      await service.resolveAlert(alert.dedupe_key, now);
    }
  }
  return rows;
}
