import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { COMPANY_MODULE } from '../../../modules/company';
import type CompanyModuleService from '../../../modules/company/service';
import { createCompanyWorkflow } from '../../../workflows/create-company';
import { siteFromRequest, siteFilter } from '../../../lib/multistore';
import { COMPANY_SITE_SCOPE } from '../../../modules/company/site-scope';
import { getB2bSalesChannelId } from '../../../modules/company/settings';

const PostCreate = z.object({
  name: z.string().min(2),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  owner_customer_id: z.string().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status ? String(req.query.status) : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // MedusaService filters pass through to MikroORM, which supports $or/$ilike.
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (q) {
    filters.$or = [
      { name: { $ilike: `%${q}%` } },
      { legal_name: { $ilike: `%${q}%` } },
      { tax_id: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ];
  }

  Object.assign(filters, await siteFilter(req.scope, await siteFromRequest(req), COMPANY_SITE_SCOPE));

  const [companies, count] = await service.listAndCountCompanies(filters, {
    skip: offset,
    take: limit,
    order: { created_at: 'DESC' },
  });
  const withCounts = await Promise.all(
    companies.map(async (c) => {
      const members = await service.listCompanyMembers({ company_id: c.id });
      return { ...c, members_count: members.length };
    }),
  );
  res.json({ companies: withCounts, count, limit, offset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const data = parsed.data;
  // Una sola lectura para las dos ramas: el canal mayorista es el mismo se cree
  // la empresa con owner o sin él, y leerlo dos veces invita a que un día una
  // rama se actualice y la otra no.
  const salesChannelId = getB2bSalesChannelId();

  if (data.owner_customer_id) {
    // Crea empresa + membership owner (enforce una membership activa por customer).
    const { result } = await createCompanyWorkflow(req.scope).run({
      input: {
        name: data.name,
        legal_name: data.legal_name ?? null,
        tax_id: data.tax_id ?? null,
        owner_customer_id: data.owner_customer_id,
        sales_channel_id: salesChannelId,
      },
    });
    res.status(201).json({ company: result });
    return;
  }
  // Sin owner: solo el registro de empresa.
  const service = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const created = await service.createCompanies({
    name: data.name,
    slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80),
    legal_name: data.legal_name ?? null,
    tax_id: data.tax_id ?? null,
    status: 'active',
    sales_channel_id: salesChannelId,
  });
  res.status(201).json({ company: Array.isArray(created) ? created[0] : created });
}
