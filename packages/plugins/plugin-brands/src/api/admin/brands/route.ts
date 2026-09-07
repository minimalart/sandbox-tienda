import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { BRAND_MODULE } from '../../../modules/brand';
import BrandModuleService from '../../../modules/brand/service';
import { createBrandWorkflow } from '../../../workflows/create-brand';
import { siteFromRequest } from '../../../lib/multistore/request';
import { siteFilter, siteDefaults } from '../../../lib/multistore/scope';
import { BRAND_SITE_SCOPE } from '../../../modules/brand/site-scope';

export const CreateBrandSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  handle: z.string().min(1, 'Handle is required'),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type CreateBrandInput = z.infer<typeof CreateBrandSchema>;

export async function POST(
  req: MedusaRequest<CreateBrandInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as CreateBrandInput;
  const site = await siteFromRequest(req);

  // Con una tienda activa, la marca nace en ESA tienda. Sin esto, crear desde la
  // tienda Norte produce una marca global que aparece en todas, y el creador no
  // tiene forma de notarlo.
  //
  // El default se aplica sólo si el cuerpo NO trae la clave: mandar `null` explícito
  // sigue significando "global", que es una elección legítima del que llama.
  const defaults = input.sales_channel_ids === undefined
    ? siteDefaults(site, BRAND_SITE_SCOPE)
    : {};

  const { result } = await createBrandWorkflow(req.scope).run({
    input: { ...input, ...defaults },
  });

  res.status(201).json({ brand: result });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);
  const site = await siteFromRequest(req);

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  // MedusaService filters pass through to MikroORM, which supports $or/$ilike.
  const filters: Record<string, unknown> = {};
  if (q) {
    filters.$or = [
      { name: { $ilike: `%${q}%` } },
      { handle: { $ilike: `%${q}%` } },
      { description: { $ilike: `%${q}%` } },
    ];
  }

  // Sin tienda activa devuelve `{}` y el listado se comporta igual que antes. El
  // filtro va DENTRO de listAndCount, no sobre el resultado: filtrar en memoria
  // —como hace el lado store— daría un `count` que no coincide con lo paginado.
  Object.assign(filters, await siteFilter(req.scope, site, BRAND_SITE_SCOPE));

  const [brands, count] = await brandService.listAndCountBrands(filters, {
    skip: offset,
    take: limit,
    order: { name: 'ASC' },
  });

  res.status(200).json({ brands, count, offset, limit });
}
