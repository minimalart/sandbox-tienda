import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { LOYALTY_MODULE } from '../../../../modules/loyalty';
import type LoyaltyModuleService from '../../../../modules/loyalty/service';
import { POINTS_MODULE } from '../../../../modules/points';
import type PointsModuleService from '../../../../modules/points/service';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { POINTS_TRANSACTION_SITE_SCOPE } from '../../../../modules/loyalty/site-scope';

// Aggregated KPIs for the loyalty dashboard. Sums are computed in-memory over a
// bounded fetch — fine for typical loyalty volumes; promote to SQL aggregates if
// the ledger grows very large.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const points = req.scope.resolve<PointsModuleService>(POINTS_MODULE);
  const loyalty = req.scope.resolve<LoyaltyModuleService>(LOYALTY_MODULE);

  const accounts = (await points.listPointsAccounts({}, { take: 20000, select: ['balance'] })) as Array<{
    balance: number;
  }>;
  const activeCustomers = accounts.filter((a) => (a.balance ?? 0) > 0).length;
  const avgBalance = accounts.length
    ? Math.round(accounts.reduce((s, a) => s + (a.balance ?? 0), 0) / accounts.length)
    : 0;

  // Los movimientos de ESTA tienda. El saldo agregado sigue siendo de la instancia
  // —una cuenta por cliente— y por eso `accounts` no se filtra: partirlo por tienda
  // dividiría el saldo de un cliente que ya compró en las dos.
  const txnSiteWhere = await siteFilter(
    req.scope,
    await siteFromRequest(req),
    POINTS_TRANSACTION_SITE_SCOPE,
  );
  const txns = (await points.listPointsTransactions(txnSiteWhere, { take: 50000, select: ['amount', 'type', 'status'] })) as Array<{
    amount: number;
    type: string;
    status: string;
  }>;
  const issued = txns
    .filter((t) => t.type === 'earn' && t.status !== 'reversed' && t.status !== 'expired')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const redeemed = txns
    .filter((t) => t.type === 'redeem')
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
  const expired = txns
    .filter((t) => t.status === 'expired')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const grants = (await loyalty.listRewardGrants({}, { relations: ['reward'], take: 5000 })) as Array<{
    status: string;
    reward?: { name?: string } | null;
  }>;
  const pendingRedemptions = grants.filter((g) => g.status === 'pending').length;

  const byReward = new Map<string, number>();
  for (const g of grants) {
    const name = g.reward?.name ?? '—';
    byReward.set(name, (byReward.get(name) ?? 0) + 1);
  }
  const topRewards = [...byReward.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    issued,
    redeemed,
    expired,
    active_customers: activeCustomers,
    avg_balance: avgBalance,
    pending_redemptions: pendingRedemptions,
    total_redemptions: grants.length,
    top_rewards: topRewards,
  });
}
