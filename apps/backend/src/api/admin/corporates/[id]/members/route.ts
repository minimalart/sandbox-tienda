import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../../../modules/corporate/site-scope';
import { Modules } from '@medusajs/framework/utils';
import { createCustomerAccountWorkflow } from '@medusajs/medusa/core-flows';
import { CORPORATE_MODULE } from '../../../../../modules/corporate';
import type CorporateModuleService from '../../../../../modules/corporate/service';
import { PostCreateMember } from '../../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const members = await service.listCorporateMembers({
    corporate_id: req.params.id as string,
  });
  let enriched = members as Array<Record<string, unknown>>;
  const customerIds = members.map((m) => m.customer_id as string).filter(Boolean);
  if (customerIds.length) {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      const customers = await customerService.listCustomers(
        { id: customerIds },
        { select: ['id', 'email', 'first_name', 'last_name'] },
      );
      const byId = new Map(customers.map((c) => [c.id, c]));
      enriched = members.map((m) => {
        const cust = byId.get(m.customer_id as string);
        return { ...m, email: cust?.email ?? null, first_name: cust?.first_name ?? null, last_name: cust?.last_name ?? null };
      });
    } catch {
      /* best-effort */
    }
  }
  res.json({ members: enriched });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // `req.params.id` es la raíz del dominio: guardarla alcanza, sus hijas no
  // son alcanzables por otra vía. Y va en TODOS los handlers, no sólo el GET.
  await assertIdInSite(req.scope, await siteFromRequest(req), CORPORATE_SITE_SCOPE, req.params.id as string);

  const parsed = PostCreateMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const corporateId = req.params.id as string;
  const data = parsed.data;
  const status = data.status ?? 'active';

  // Resolver el customer: usar el existente o crear la cuenta (auth + customer)
  // para que el cliente pueda iniciar sesión con email + contraseña.
  let customerId = data.customer_id;
  if (!customerId) {
    try {
      const authModule = req.scope.resolve(Modules.AUTH);
      const reg = await authModule.register('emailpass', {
        body: { email: data.email as string, password: data.password as string },
      });
      if (!reg.success || !reg.authIdentity) {
        res.status(400).json({ message: reg.error ?? 'No se pudo crear la cuenta (¿el email ya está registrado?).' });
        return;
      }
      const { result: customer } = await createCustomerAccountWorkflow(req.scope).run({
        input: {
          authIdentityId: reg.authIdentity.id,
          customerData: { email: data.email as string, first_name: data.first_name, last_name: data.last_name, phone: data.phone },
        },
      });
      customerId = customer.id;
    } catch (e) {
      res.status(400).json({
        message: e instanceof Error && /exist/i.test(e.message) ? 'Ya existe una cuenta con ese email.' : 'No se pudo crear la cuenta del cliente.',
      });
      return;
    }
  }

  const created = await service.createCorporateMembers({
    corporate_id: corporateId,
    customer_id: customerId,
    role: data.role ?? 'buyer',
    status,
    joined_at: new Date(),
  });
  const member = Array.isArray(created) ? created[0] : created;

  // Sync con el customer group de la empresa, si existe.
  const corporate = await service.retrieveCorporate(corporateId);
  if (corporate?.customer_group_id && status === 'active') {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.addCustomerToGroup({
        customer_id: customerId,
        customer_group_id: corporate.customer_group_id as string,
      });
    } catch {
      /* best-effort */
    }
  }

  res.status(201).json({ member });
}
