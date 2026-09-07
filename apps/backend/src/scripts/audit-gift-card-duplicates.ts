import type { ExecArgs, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/** Read-only report. It never disables or modifies an official gift card. */
export default async function auditGiftCardDuplicates({ container }: ExecArgs): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const knex = container.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION);
  const rows = await knex('loyalty_gift_card')
    .select(['reference_id', 'line_item_id'])
    .select(knex.raw('COUNT(*)::int AS card_count'))
    .select(knex.raw("ARRAY_AGG(id ORDER BY created_at) AS gift_card_ids"))
    .where({ reference: 'order' })
    .whereNotNull('reference_id')
    .whereNotNull('line_item_id')
    .whereNull('deleted_at')
    .groupBy('reference_id', 'line_item_id')
    .havingRaw('COUNT(*) > 1');
  logger.info(`[gift-card-audit] ${rows.length} order/item group(s) have more than one official card.`);
  for (const row of rows) {
    logger.warn(`[gift-card-audit] order=${row.reference_id} line_item=${row.line_item_id} cards=${row.card_count} ids=${row.gift_card_ids.join(',')}`);
  }
  logger.info('[gift-card-audit] Report only: no card was changed. Claimed, used and ambiguous cards require manual review.');
}
