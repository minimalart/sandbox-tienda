import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../../../../modules/company';
import type CompanyModuleService from '../../../../../../modules/company/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { COMPANY_SITE_SCOPE } from '../../../../../../modules/company/site-scope';

const PostUpdateMember = z.object({
  role: z.enum(['admin', 'buyer', 'viewer']).optional(),
  status: z.enum(['invited', 'active', 'disabled']).optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre, como en `companies/[id]/members`: `company_member` no tiene
  // canal propio, lo hereda de la empresa.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const parsed = PostUpdateMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const memberId = req.params.memberId as string;
  const companyId = req.params.id as string;
  const before = await service.retrieveCompanyMember(memberId);

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA, y hacen falta las
    dos. `:memberId` se resuelve por su PK y el `:id` del path sólo se usaba para
    sincronizar el customer group, así que una empresa propia en `:id` con un
    `:memberId` de otra empresa pasaba el guard y mutaba al miembro ajeno — de yapa
    metiéndolo en MI grupo de clientes.

    404 y no 403 por lo mismo que el guard de tienda: el status no tiene que delatar
    que ese miembro existe en otro lado.
  */
  if (before?.company_id !== companyId) {
    res.status(404).json({ type: 'not_found', message: 'Miembro no encontrado' });
    return;
  }

  const updated = await service.updateCompanyMembers({ id: memberId, ...parsed.data } as any);

  // Si cambió el estado, sincronizamos el customer group de la empresa.
  const company = await service.retrieveCompany(companyId);
  const cgId = company?.customer_group_id as string | undefined;
  if (cgId && parsed.data.status && parsed.data.status !== before?.status) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const entry = {
        customer_id: before.customer_id as string,
        customer_group_id: cgId,
      };
      if (parsed.data.status === 'active') {
        await customerService.addCustomerToGroup(entry);
      } else {
        await customerService.removeCustomerFromGroup(entry);
      }
    } catch {
      /* best-effort */
    }
  }

  res.json({ member: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre, como en `companies/[id]/members`. Y en TODOS los verbos: un
  // DELETE sin guard le saca el acceso a un comprador de otra tienda, que es la
  // versión irreversible del mismo agujero.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const memberId = req.params.memberId as string;
  const companyId = req.params.id as string;
  const member = await service.retrieveCompanyMember(memberId);

  // Pertenencia, igual que en el POST. Acá importa más: el borrado es irreversible.
  if (member?.company_id !== companyId) {
    res.status(404).json({ type: 'not_found', message: 'Miembro no encontrado' });
    return;
  }

  const company = await service.retrieveCompany(companyId);
  const cgId = company?.customer_group_id as string | undefined;
  if (cgId && member?.customer_id) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.removeCustomerFromGroup({
        customer_id: member.customer_id as string,
        customer_group_id: cgId,
      });
    } catch {
      /* best-effort */
    }
  }

  await service.deleteCompanyMembers([memberId]);
  res.json({ id: memberId, deleted: true });
}
