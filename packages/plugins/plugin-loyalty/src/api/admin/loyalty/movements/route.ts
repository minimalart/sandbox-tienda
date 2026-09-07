import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { POINTS_MODULE } from '../../../../modules/points';
import type PointsModuleService from '../../../../modules/points/service';

import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteFilter } from '../../../../lib/multistore/scope';
import { POINTS_TRANSACTION_SITE_SCOPE } from '../../../../modules/loyalty/site-scope';

// Paginated ledger movements for the backoffice "Movimientos" list.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const points = req.scope.resolve<PointsModuleService>(POINTS_MODULE);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const [movements, count] = await points.listAndCountPointsTransactions(
    { ...(await siteFilter(req.scope, await siteFromRequest(req), POINTS_TRANSACTION_SITE_SCOPE)) },
    { take: limit, skip: offset, order: { created_at: 'DESC' } },
  );
  res.json({ movements, count, limit, offset });
}
