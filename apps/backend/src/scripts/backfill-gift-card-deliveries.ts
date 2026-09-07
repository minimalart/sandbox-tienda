import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
// The gift-card contract lives in @minimalart/mercatto-plugin-gift-cards. The
// host keeps a minimal shim in `../lib/shared` (only these two symbols) so this
// pnpm script (`pnpm gift-cards:backfill`) can run without loading the plugin
// entry points — Medusa CLI is the caller and the plugin service is resolved
// at runtime from the container by its module key.
import { assertGiftCardBuyerIsNotRecipient, normalizeGiftCardConfig } from '../lib/shared';

// The plugin's module key is `gift_card_experience`. The service is resolved
// dynamically to avoid a hard runtime dependency on the plugin's package
// export map from a bare script — same reason we don't import `resolveBackingAccount`
// here. If the plugin is not installed, the container resolve throws with a
// clear message that names the module key.
const GIFT_CARD_EXPERIENCE_MODULE = 'gift_card_experience';
type GiftCardExperienceModuleService = {
  getSettings(siteId: string | null): Promise<any>;
  ensureDefaultDesign(): Promise<any>;
  resolveDesign(designId: string, active: boolean): Promise<any | null>;
  createDeliveryIntent(input: Record<string, unknown>): Promise<{ created: boolean; delivery: { id: string } }>;
  markIssued(id: string, input: Record<string, unknown>): Promise<unknown>;
  updateGiftCardDeliveries(input: Record<string, unknown>): Promise<unknown>;
};

/**
 * Inlined here from the plugin's `process-order.ts` — see comment above on why
 * this script does not import the plugin's runtime entry points.
 */
async function resolveBackingAccount(
  container: any,
  giftCardId: string,
): Promise<{ id: string; code?: string } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as {
    graph(input: unknown): Promise<{ data: unknown[] }>;
  };
  const { data } = await query.graph({
    entity: 'gift_card',
    fields: ['id', 'store_credit_accounts.id', 'store_credit_accounts.code'],
    filters: { id: giftCardId },
  });
  const row = data[0] as { store_credit_accounts?: Array<{ id: string; code?: string }> } | undefined;
  return row?.store_credit_accounts?.[0] ?? null;
}

type LegacyOrder = {
  id: string; display_id?: number; email: string; customer_id?: string | null; currency_code: string;
  items?: Array<{ id: string; quantity: number; unit_price: number; total?: number; metadata?: Record<string, unknown> | null }>;
};

/**
 * Backfills only exact order/item/card cardinality matches. Ambiguous groups are
 * reported and left untouched; delivery is marked legacy and never re-sent.
 */
export default async function backfillGiftCardDeliveries({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const knex = container.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION);
  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  // `null` EXPLÍCITO: esto rellena entregas de gift cards emitidas ANTES de que
  // existiera el módulo —y antes de que existieran las tiendas—, y las marca legacy
  // para que nunca se reenvíen. La fila global es la única configuración que puede
  // corresponderles; resolverles una tienda hoy sería inventarles una procedencia.
  const settings = await service.getSettings(null);
  const fallbackDesign = await service.ensureDefaultDesign();
  const groups = await knex('loyalty_gift_card')
    .select(['reference_id', 'line_item_id'])
    .select(knex.raw('ARRAY_AGG(id ORDER BY created_at) AS gift_card_ids'))
    .where({ reference: 'order' }).whereNotNull('reference_id').whereNotNull('line_item_id').whereNull('deleted_at')
    .groupBy('reference_id', 'line_item_id');
  let created = 0;
  let ambiguous = 0;
  for (const group of groups) {
    const { data } = await query.graph({
      entity: 'order',
      fields: ['id', 'display_id', 'email', 'customer_id', 'currency_code', 'items.id', 'items.quantity', 'items.unit_price', 'items.total', 'items.metadata'],
      filters: { id: group.reference_id },
    }) as { data: LegacyOrder[] };
    const order = data[0];
    const item = order?.items?.find((candidate) => candidate.id === group.line_item_id);
    const quantity = Math.max(1, Math.trunc(Number(item?.quantity) || 1));
    if (!order || !item || group.gift_card_ids.length !== quantity) {
      ambiguous += 1;
      logger.warn(`[gift-card-backfill] legacy ambiguous order=${group.reference_id} line_item=${group.line_item_id}`);
      continue;
    }
    try {
      const config = normalizeGiftCardConfig(item.metadata ?? {}, settings.default_design_id);
      assertGiftCardBuyerIsNotRecipient(config, order.email);
      const design = await service.resolveDesign(config.design_id, true) ?? fallbackDesign;
      for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
        const result = await service.createDeliveryIntent({
          idempotency_key: `gift-card:${order.id}:${item.id}:${unitIndex}`,
          order_id: order.id, order_display_id: order.display_id ?? null, line_item_id: item.id, unit_index: unitIndex,
          buyer_customer_id: order.customer_id ?? null, buyer_email: order.email, config, design,
          currency_code: order.currency_code, face_value: Number(item.unit_price),
          paid_amount: Number(item.total ?? Number(item.unit_price) * quantity) / quantity,
          timezone: settings.timezone,
        });
        if (!result.created) continue;
        const giftCardId = group.gift_card_ids[unitIndex] as string;
        const account = await resolveBackingAccount(container, giftCardId);
        await service.markIssued(result.delivery.id, { giftCardId, storeCreditAccountId: account?.id ?? null, deliveryStatus: 'sent' });
        await service.updateGiftCardDeliveries({ id: result.delivery.id, legacy: true, next_retry_at: null });
        created += 1;
      }
    } catch (error) {
      ambiguous += 1;
      logger.warn(`[gift-card-backfill] skipped order=${order.id} line_item=${item.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  logger.info(`[gift-card-backfill] created=${created} ambiguous_or_legacy=${ambiguous}; no official card was modified.`);
}
