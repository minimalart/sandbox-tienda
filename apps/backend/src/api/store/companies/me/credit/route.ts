import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { COMPANY_MODULE } from '../../../../../modules/company';
import type CompanyModuleService from '../../../../../modules/company/service';
import { COMPANY_CREDIT_MODULE } from '../../../../../modules/company-credit';
import type CompanyCreditModuleService from '../../../../../modules/company-credit/service';

/**
 * Resumen de la cuenta corriente de la empresa del cliente logueado.
 * `amount` opcional (total del carrito) → `can_use` refleja si alcanza el crédito.
 */
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
    res.json({ account: null });
    return;
  }
  const account = await creditService.getAccountByCompany(membership.company_id);
  if (!account) {
    res.json({ account: null });
    return;
  }

  const available = creditService.availableCredit(account);
  const amount = req.query.amount ? Number(req.query.amount) : null;
  const can_use =
    account.status === 'active' &&
    (amount == null || (Number.isFinite(amount) && available >= amount));

  res.json({
    account: {
      status: account.status,
      currency_code: account.currency_code,
      credit_limit: account.credit_limit,
      current_balance: account.current_balance,
      available_credit: available,
      payment_terms_days: account.payment_terms_days,
    },
    can_use,
  });
}
