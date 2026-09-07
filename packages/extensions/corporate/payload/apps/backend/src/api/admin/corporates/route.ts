import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteDefaults, siteFilter } from '../../../lib/multistore/scope';
import { CORPORATE_SITE_SCOPE } from '../../../modules/corporate/site-scope';
import { CORPORATE_MODULE } from '../../../modules/corporate';
import type CorporateModuleService from '../../../modules/corporate/service';
import { PostCreateCorporate } from './validators';

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `empresa-${Date.now()}`;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
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
      { email_domain: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ];
  }
  // Al WHERE, no en memoria: el listado pagina y `count` alimenta la columna de la
  // tabla. Filtrar después haría que el número no coincida con las filas.
  const resolution = await siteFromRequest(req);
  Object.assign(filters, await siteFilter(req.scope, resolution, CORPORATE_SITE_SCOPE));

  const [corporates, count] = await service.listAndCountCorporates(filters, {
    skip: offset,
    take: limit,
    order: { created_at: 'DESC' },
  });

  // Conteo de miembros por empresa (para la columna Members).
  const withCounts = await Promise.all(
    corporates.map(async (c) => {
      const members = await service.listCorporateMembers({ corporate_id: c.id });
      return { ...c, members_count: members.length };
    }),
  );

  res.json({ corporates: withCounts, count, limit, offset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostCreateCorporate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid body' });
    return;
  }
  const service = req.scope.resolve<CorporateModuleService>(CORPORATE_MODULE);
  const data = parsed.data;

  /**
   * La empresa nace en la tienda activa. Sin esto, el operador la crea desde su
   * tienda y aparece en todas — y como el listado sí filtra, no vuelve a encontrarla
   * donde la creó.
   */
  const created = await service.createCorporates({
    ...siteDefaults(await siteFromRequest(req), CORPORATE_SITE_SCOPE),
    name: data.name,
    slug: data.slug?.trim() || slugify(data.name),
    legal_name: data.legal_name ?? null,
    tax_id: data.tax_id ?? null,
    email_domain: data.email_domain ?? null,
    status: data.status ?? 'pending',
    customer_group_id: null,
    metadata: data.metadata ?? null,
  });
  const corporate = Array.isArray(created) ? created[0] : created;

  // Si el admin indicó un owner, creamos su membership.
  if (data.owner_customer_id && corporate) {
    await service.createCorporateMembers({
      corporate_id: corporate.id,
      customer_id: data.owner_customer_id,
      role: 'owner',
      status: 'active',
      joined_at: new Date(),
    });
  }

  res.status(201).json({ corporate });
}
