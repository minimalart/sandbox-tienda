import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { COMPANY_MODULE } from '../../../../../../modules/company';
import type CompanyModuleService from '../../../../../../modules/company/service';
import { COMPANY_CREDIT_MODULE } from '../../../../../../modules/company-credit';
import type CompanyCreditModuleService from '../../../../../../modules/company-credit/service';

type TxFilters = {
  company_id: string;
  type?: string;
  created_at?: { $gte?: Date; $lte?: Date };
};

/** Historial de movimientos (estado de cuenta) con filtros de fecha y tipo. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context.actor_id;
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const creditService =
    req.scope.resolve<CompanyCreditModuleService>(COMPANY_CREDIT_MODULE);

  const membership = await companyService.getMembershipByCustomer(customerId);
  if (!membership) {
    res.json({ transactions: [], count: 0 });
    return;
  }

  const filters: TxFilters = { company_id: membership.company_id };
  const type = req.query.type ? String(req.query.type) : '';
  if (type) filters.type = type;
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  if (from || to) {
    filters.created_at = {};
    if (from && !Number.isNaN(from.getTime())) filters.created_at.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filters.created_at.$lte = to;
  }

  const take = Math.min(Number(req.query.limit ?? 100) || 100, 500);
  const skip = Number(req.query.offset ?? 0) || 0;

  const [transactions, count] = await creditService.listAndCountCompanyCreditTransactions(
    filters as Record<string, unknown>,
    { order: { created_at: 'DESC' }, take, skip },
  );
  res.json({ transactions, count, limit: take, offset: skip });
}
