import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { COMPANY_CREDIT_MODULE } from '../../../../../modules/company-credit';
import type CompanyCreditModuleService from '../../../../../modules/company-credit/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { COMPANY_SITE_SCOPE } from '../../../../../modules/company/site-scope';

const PostCreate = z.object({
  credit_limit: z.number().min(0),
  currency_code: z.string().min(2).optional(),
  status: z.enum(['active', 'suspended', 'blocked']).optional(),
  payment_terms_days: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

/** Cuenta corriente + crédito disponible + últimos movimientos de la empresa. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const companyId = req.params.id as string;
  const service =
    req.scope.resolve<CompanyCreditModuleService>(COMPANY_CREDIT_MODULE);

  const account = await service.getAccountByCompany(companyId);
  if (!account) {
    res.json({ account: null, available_credit: null, transactions: [] });
    return;
  }
  const transactions = await service.listCompanyCreditTransactions(
    { company_id: companyId },
    { order: { created_at: 'DESC' }, take: 10 },
  );
  res.json({
    account,
    available_credit: service.availableCredit(account),
    transactions,
  });
}

/** Crea la cuenta corriente de la empresa (una sola). */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const parsed = PostCreate.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const companyId = req.params.id as string;
  const service =
    req.scope.resolve<CompanyCreditModuleService>(COMPANY_CREDIT_MODULE);

  const account = await service.createAccount({
    company_id: companyId,
    ...parsed.data,
  });
  res.json({ account, available_credit: service.availableCredit(account) });
}
