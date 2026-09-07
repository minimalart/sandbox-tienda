import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { createCustomerAccountWorkflow } from '@medusajs/medusa/core-flows';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../../../modules/company';
import type CompanyModuleService from '../../../../../modules/company/service';

import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { COMPANY_SITE_SCOPE } from '../../../../../modules/company/site-scope';

const PostCreateMember = z
  .object({
    // Alta directa creando la cuenta:
    email: z.string().email().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8).optional(),
    // O vincular un customer existente:
    customer_id: z.string().optional(),
    role: z.enum(['owner', 'admin', 'buyer', 'viewer']).optional(),
    status: z.enum(['invited', 'active', 'disabled']).optional(),
  })
  .refine((d) => !!d.customer_id || (!!d.email && !!d.password), {
    message: 'Indicá un customer_id, o email y contraseña para crear la cuenta.',
  });

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const members = await service.listCompanyMembers({ company_id: req.params.id as string });
  res.json({ members });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // El id del padre. Todos los handlers: el listado filtra, pero el id se
  // adivina desde ahí.
  await assertIdInSite(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE, req.params.id as string);

  const parsed = PostCreateMember.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const companyId = req.params.id as string;
  const data = parsed.data;
  const status = data.status ?? 'active';

  // Resolver el customer: usar el existente o crear la cuenta (auth + customer)
  // para que el usuario pueda iniciar sesión con email + contraseña.
  let customerId = data.customer_id;
  if (!customerId) {
    try {
      const authModule = req.scope.resolve(Modules.AUTH);
      const reg = await authModule.register('emailpass', {
        body: { email: data.email as string, password: data.password as string },
      });
      if (!reg.success || !reg.authIdentity) {
        res.status(400).json({
          message: reg.error ?? 'No se pudo crear la cuenta (¿el email ya está registrado?).',
        });
        return;
      }
      const { result: customer } = await createCustomerAccountWorkflow(req.scope).run({
        input: {
          authIdentityId: reg.authIdentity.id,
          customerData: {
            email: data.email as string,
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone,
          },
        },
      });
      customerId = customer.id;
    } catch (e) {
      res.status(400).json({
        message:
          e instanceof Error && /exist/i.test(e.message)
            ? 'Ya existe una cuenta con ese email.'
            : 'No se pudo crear la cuenta del usuario.',
      });
      return;
    }
  }

  // v1: a lo sumo UNA membership activa por customer.
  const existing = await service.getMembershipByCustomer(customerId);
  if (existing) {
    res.status(400).json({ message: 'El cliente ya pertenece a una empresa.' });
    return;
  }

  const created = await service.createCompanyMembers({
    company_id: companyId,
    customer_id: customerId,
    role: data.role ?? 'buyer',
    status,
    joined_at: new Date(),
  });
  const member = Array.isArray(created) ? created[0] : created;

  // Sync con el customer group de la empresa, si existe.
  const company = await service.retrieveCompany(companyId);
  if (company?.customer_group_id && status === 'active') {
    try {
      const customerService = req.scope.resolve(Modules.CUSTOMER);
      await customerService.addCustomerToGroup({
        customer_id: customerId,
        customer_group_id: company.customer_group_id as string,
      });
    } catch {
      /* best-effort */
    }
  }

  res.status(201).json({ member });
}
