import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../../modules/corporate/service';
import { PostUpdateMember } from '../../../validators';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../../modules/corporate/site-scope';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio, como en `corporates/[id]/members`: el
  // miembro no tiene tienda propia, la hereda de la empresa (`CORPORATE_MEMBER_SITE_SCOPE`
  // es un `via_parent` sobre este mismo descriptor).
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostUpdateMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const memberId = req.params.memberId as string;
  const corporateId = req.params.id as string;
  const before = await service.retrieveCorporateMember(memberId);

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA, y hacen falta las
    dos. `:memberId` se resuelve por su PK y el `:id` del path sólo se usaba para
    sincronizar el customer group, así que una empresa propia en `:id` con un
    `:memberId` de otra empresa pasaba el guard y mutaba al miembro ajeno — de yapa
    metiéndolo en MI grupo de clientes.

    Se compara contra el `:id` de la URL y no contra el subselect de tienda a
    propósito: el par (empresa, miembro) tiene que ser coherente, no alcanza con que
    el miembro caiga en ALGUNA empresa mía. Un `via_parent` sobre `corporate_member`
    resolvería el eje en una sola llamada y seguiría aceptando el cruce entre dos
    empresas propias.

    404 y no 403 por lo mismo que el guard de tienda: el status no tiene que delatar
    que ese miembro existe en otro lado.
  */
  if (before?.corporate_id !== corporateId) {
    res.status(404).json({ type: 'not_found', message: 'Miembro no encontrado' });
    return;
  }

  const updated = await service.updateCorporateMembers({ id: memberId, ...parsed.data } as any);

  // Si cambió el estado, sincronizamos el customer group de la empresa.
  const corporate = await service.retrieveCorporate(corporateId);
  const cgId = corporate?.customer_group_id as string | undefined;
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
  // `req.params.id` es la raíz del dominio, y el guard va en TODOS los verbos: un
  // DELETE sin guard le corta el acceso B2B a un comprador de otra tienda y no hay
  // undo.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const memberId = req.params.memberId as string;
  const corporateId = req.params.id as string;
  const member = await service.retrieveCorporateMember(memberId);

  // Pertenencia, igual que en el POST. Acá importa más: el borrado es irreversible y
  // además saca al cliente del customer group, o sea que el daño se propaga a los
  // precios B2B de una empresa que ni siquiera es la del path.
  if (member?.corporate_id !== corporateId) {
    res.status(404).json({ type: 'not_found', message: 'Miembro no encontrado' });
    return;
  }

  const corporate = await service.retrieveCorporate(corporateId);
  const cgId = corporate?.customer_group_id as string | undefined;
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

  await service.deleteCorporateMembers([memberId]);
  res.json({ id: memberId, deleted: true });
}
