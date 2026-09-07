import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { RECURRING_ORDER_MODULE } from '../../../../modules/recurring-order';
import type RecurringOrderModuleService from '../../../../modules/recurring-order/service';

const csv = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

/** Exportación operativa reconciliable: contrato, último ciclo, cobro y pedido. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<RecurringOrderModuleService>(RECURRING_ORDER_MODULE);
  const status = (req.query.status as string | undefined) || null;
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const scope = siteChannelFilter(
    await siteFromRequest(req),
    (req.query.sales_channel_id as string | undefined) || undefined,
  );
  const subscriptions: any[] = await service.listRecurringOrders(
    { ...scope, ...(status ? { status } : {}) },
    { take: 10000, order: { created_at: 'DESC' }, relations: ['items'] },
  );
  const ids = subscriptions.map((subscription) => subscription.id);
  const cycles: any[] = ids.length
    ? await service.listRenewalCycles(
        { recurring_order_id: ids },
        { take: 50000, order: { scheduled_at: 'DESC' } },
      )
    : [];
  const latestCycle = new Map<string, any>();
  for (const cycle of cycles) {
    if (!latestCycle.has(cycle.recurring_order_id)) latestCycle.set(cycle.recurring_order_id, cycle);
  }
  const rows = subscriptions.filter((subscription) => {
    if (!q) return true;
    const cycle = latestCycle.get(subscription.id);
    return [
      subscription.id, subscription.customer_id, subscription.email,
      subscription.plan_id, subscription.external_subscription_id,
      cycle?.generated_order_id, cycle?.provider_payment_id,
    ].some((value) => String(value ?? '').toLowerCase().includes(q));
  });
  const columns = [
    'subscription_id', 'customer_id', 'email', 'sales_channel_id', 'plan_id',
    'offer_id', 'status', 'financial_status', 'payment_provider', 'payment_mode',
    'frequency', 'next_billing_at', 'cycles_completed', 'item_count',
    'latest_cycle_id', 'latest_cycle_status', 'expected_amount', 'charged_amount',
    'provider_payment_id', 'generated_order_id', 'created_at', 'cancelled_at',
  ];
  const lines = [columns.join(',')];
  for (const subscription of rows) {
    const cycle = latestCycle.get(subscription.id);
    lines.push([
      subscription.id,
      subscription.customer_id,
      subscription.email,
      subscription.sales_channel_id,
      subscription.plan_id,
      subscription.offer_id,
      subscription.status,
      subscription.financial_status,
      subscription.payment_provider,
      subscription.payment_mode,
      `${subscription.frequency_count} ${subscription.frequency_interval}`,
      subscription.next_billing_at ?? subscription.next_execution_at,
      subscription.cycles_completed,
      (subscription.items ?? []).length,
      cycle?.id,
      cycle?.status,
      cycle?.expected_amount,
      cycle?.charged_amount,
      cycle?.provider_payment_id,
      cycle?.generated_order_id,
      subscription.created_at,
      subscription.cancelled_at,
    ].map(csv).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="suscripciones-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.status(200).send(`\uFEFF${lines.join('\n')}`);
}
