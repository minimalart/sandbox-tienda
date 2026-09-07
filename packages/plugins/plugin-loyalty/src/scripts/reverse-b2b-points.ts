import type { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { POINTS_MODULE } from '../modules/points';
import type PointsModuleService from '../modules/points/service';

/**
 * Reverses loyalty points that were wrongly awarded for B2B orders (before the
 * order-placed-points subscriber learned to skip them). Points are B2C-only.
 *
 *   npx medusa exec ./src/scripts/reverse-b2b-points.ts
 *
 * For each `earn` transaction referencing a B2B order (sales channel
 * `channel_type: 'b2b'` or order `metadata.context: 'b2b'`), it writes a
 * compensating negative `adjust` entry and decrements the account balance.
 * Append-only + idempotent: re-running skips earns already reversed.
 */
type EarnTxn = {
  id: string;
  amount: number;
  account_id: string;
  reference: string | null;
  reference_id: string | null;
};

const REVERSAL_REF = 'order_b2b_reversal';

export default async function reverseB2bPoints({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const points = container.resolve<PointsModuleService>(POINTS_MODULE);

  const earns = (await points.listPointsTransactions({
    type: 'earn',
    reference: 'order',
  })) as unknown as EarnTxn[];

  const orderIds = [...new Set(earns.map((t) => t.reference_id).filter((id): id is string => !!id))];
  if (!orderIds.length) {
    logger.info('[reverse-b2b-points] No earn-from-order transactions. Nothing to do.');
    return;
  }

  const { data: orders } = await query.graph({
    entity: 'order',
    fields: ['id', 'metadata', 'sales_channel.metadata'],
    filters: { id: orderIds },
  });
  const b2bOrders = new Set(
    (orders as { id: string; metadata: { context?: string } | null; sales_channel: { metadata: { channel_type?: string } | null } | null }[])
      .filter(
        (o) =>
          o.sales_channel?.metadata?.channel_type === 'b2b' || o.metadata?.context === 'b2b',
      )
      .map((o) => o.id),
  );

  // Idempotency: earn txn ids that already have a reversal.
  const reversals = (await points.listPointsTransactions({
    reference: REVERSAL_REF,
  })) as unknown as { reference_id: string | null }[];
  const alreadyReversed = new Set(reversals.map((r) => r.reference_id));

  let reversedCount = 0;
  let reversedPoints = 0;
  for (const earn of earns) {
    if (!earn.reference_id || !b2bOrders.has(earn.reference_id)) continue;
    if (alreadyReversed.has(earn.id)) continue;
    if (!earn.account_id || !(earn.amount > 0)) continue;

    await points.createPointsTransactions({
      account_id: earn.account_id,
      amount: -earn.amount,
      type: 'adjust',
      reference: REVERSAL_REF,
      reference_id: earn.id,
    });
    const account = await points.retrievePointsAccount(earn.account_id);
    await points.updatePointsAccounts({
      id: earn.account_id,
      balance: (account.balance ?? 0) - earn.amount,
    });

    reversedCount += 1;
    reversedPoints += earn.amount;
    logger.info(
      `[reverse-b2b-points] Reversed ${earn.amount} pts (earn ${earn.id}, order ${earn.reference_id}).`,
    );
  }

  logger.info(
    `[reverse-b2b-points] Done. Reversed ${reversedCount} transaction(s), ${reversedPoints} points total.`,
  );
}
