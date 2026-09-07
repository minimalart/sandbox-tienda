import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { COMPANY_CREDIT_MODULE } from '../../../../../../modules/company-credit';
import type CompanyCreditModuleService from '../../../../../../modules/company-credit/service';
import { MANUAL_TRANSACTION_TYPES } from '../../../../../../modules/company-credit/types';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { COMPANY_SITE_SCOPE } from '../../../../../../modules/company/site-scope';

const PostTransaction = z.object({
  // Solo movimientos manuales; la compra la registra el subscriber de order.placed.
  type: z.enum(['pago', 'nota_credito', 'nota_debito', 'ajuste']),
  amount: z.number(),
  notes: z.string().optional().nullable(),
});

type TxFilters = {
  company_id: string;
  type?: string;
  created_at?: { $gte?: Date; $lte?: Date };
};

/** Historial de movimientos con filtros (tipo, rango de fechas) + paginación. */
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

  const filters: TxFilters = { company_id: companyId };
  const type = req.query.type ? String(req.query.type) : '';
  if (type) filters.type = type;
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  if (from || to) {
    filters.created_at = {};
    if (from && !Number.isNaN(from.getTime())) filters.created_at.$gte = from;
    if (to && !Number.isNaN(to.getTime())) filters.created_at.$lte = to;
  }

  const take = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const skip = Number(req.query.offset ?? 0) || 0;

  const [transactions, count] = await service.listAndCountCompanyCreditTransactions(
    filters as Record<string, unknown>,
    { order: { created_at: 'DESC' }, take, skip },
  );
  res.json({ transactions, count, limit: take, offset: skip });
}

/** Registra un movimiento manual (pago / nota / ajuste). Compra solo vía orden. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const parsed = PostTransaction.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  if (!MANUAL_TRANSACTION_TYPES.includes(parsed.data.type)) {
    res.status(400).json({ message: 'Tipo de movimiento no permitido a mano.' });
    return;
  }
  const companyId = req.params.id as string;
  const service =
    req.scope.resolve<CompanyCreditModuleService>(COMPANY_CREDIT_MODULE);

  const account = await service.getAccountByCompany(companyId);
  if (!account) {
    res.status(404).json({ message: 'La empresa no tiene cuenta corriente.' });
    return;
  }

  const { transaction, account: updated } = await service.applyTransaction({
    accountId: account.id,
    type: parsed.data.type,
    amount: parsed.data.amount,
    created_by: req.auth_context?.actor_id ?? 'admin',
    notes: parsed.data.notes ?? null,
  });
  res.json({
    transaction,
    account: updated,
    available_credit: service.availableCredit(updated),
  });
}
