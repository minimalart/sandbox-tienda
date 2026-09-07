import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../modules/corporate/site-scope';
import { Modules } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../../../../modules/corporate';
import type CorporateModuleService from '../../../../modules/corporate/service';
import { PostUpdateCorporate } from '../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const id = req.params.id as string;
  const corporate = await service.retrieveCorporate(id);
  const members = await service.listCorporateMembers({ corporate_id: id });
  const rules = await service.listCorporateRules({ corporate_id: id });

  let enrichedMembers = members as Array<Record<string, unknown>>;
  const customerIds = members.map((m) => m.customer_id as string).filter(Boolean);
  if (customerIds.length) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const customers = await customerService.listCustomers(
        { id: customerIds },
        { select: ['id', 'email', 'first_name', 'last_name'] },
      );
      const byId = new Map(customers.map((c) => [c.id, c]));
      enrichedMembers = members.map((m) => {
        const cust = byId.get(m.customer_id as string);
        return { ...m, email: cust?.email ?? null, first_name: cust?.first_name ?? null, last_name: cust?.last_name ?? null };
      });
    } catch {
      /* best-effort */
    }
  }

  res.json({ corporate: { ...corporate, members: enrichedMembers, rules } });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostUpdateCorporate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const id = req.params.id as string;
  const updated = await service.updateCorporates({ id, ...parsed.data } as any);
  res.json({ corporate: updated });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const id = req.params.id as string;
  const existing = await service.retrieveCorporate(id);

  // Libera el customer group creado para la empresa (si lo hubiera).
  const cgId = existing?.customer_group_id as string | undefined;
  if (cgId) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.deleteCustomerGroups([cgId]);
    } catch {
      /* best-effort */
    }
  }

  const members = await service.listCorporateMembers({ corporate_id: id });
  if (members.length) {
    await service.deleteCorporateMembers(members.map((m) => m.id));
  }
  const rules = await service.listCorporateRules({ corporate_id: id });
  if (rules.length) {
    await service.deleteCorporateRules(rules.map((r) => r.id));
  }
  await service.deleteCorporates([id]);

  res.json({ id, deleted: true });
}
