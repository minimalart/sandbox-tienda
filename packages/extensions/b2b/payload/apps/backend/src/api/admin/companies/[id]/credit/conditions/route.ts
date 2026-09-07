import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';
import { COMPANY_CREDIT_MODULE } from '../../../../../../modules/company-credit';
import type CompanyCreditModuleService from '../../../../../../modules/company-credit/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { COMPANY_SITE_SCOPE } from '../../../../../../modules/company/site-scope';

const PostConditions = z
  .object({
    credit_limit: z.number().min(0).optional(),
    status: z.enum(['active', 'suspended', 'blocked']).optional(),
    payment_terms_days: z.number().int().min(0).optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'No hay condiciones para actualizar.',
  });

/** Edita condiciones de la cuenta (límite, estado, días de pago, notas). Nunca balance. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El id del padre, igual que en `credit`: la cuenta corriente no tiene canal
  // propio, se llega a ella por `getAccountByCompany` — así que guardando la EMPRESA
  // queda cubierto también el hijo, porque el `:id` del path es lo único que elige
  // sobre qué cuenta se escribe. Y esto es límite de crédito y estado de bloqueo: la
  // mutación más cara del dominio B2B.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const parsed = PostConditions.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
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
  const updated = await service.updateConditions(account.id, parsed.data);
  res.json({ account: updated, available_credit: service.availableCredit(updated) });
}
