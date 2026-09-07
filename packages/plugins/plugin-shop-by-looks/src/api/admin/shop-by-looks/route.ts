import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { SHOP_BY_LOOK_MODULE } from '../../../modules/shop-by-look';
import ShopByLookModuleService from '../../../modules/shop-by-look/service';
import { createShopByLookWorkflow } from '../../../workflows/create-shop-by-look';
import { siteFromRequest, siteFilter, siteDefaults } from '../../../lib/multistore';
import { SHOP_BY_LOOK_SITE_SCOPE } from '../../../modules/shop-by-look/site-scope';

export const PLACEMENTS = [
  'top',
  'after_collections',
  'after_featured',
  'before_footer',
] as const;

export const ShopByLookProductSchema = z.object({
  product_id: z.string().min(1, 'product_id is required'),
  variant_id: z.string().nullable().optional(),
  pos_x: z.number().int().min(0).max(100).optional().default(50),
  pos_y: z.number().int().min(0).max(100).optional().default(50),
  sort_order: z.number().int().optional().default(0),
});

export const CreateShopByLookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().nullable().optional(),
  cta_label: z.string().nullable().optional(),
  image_url: z.string().min(1, 'Image is required'),
  image_alt: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
  placement: z.enum(PLACEMENTS).optional().default('after_featured'),
  sales_channel_ids: z.array(z.string()).nullable().optional(),
  region_ids: z.array(z.string()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  products: z.array(ShopByLookProductSchema).optional().default([]),
});

type CreateShopByLookInput = z.infer<typeof CreateShopByLookSchema>;

export async function POST(
  req: MedusaRequest<CreateShopByLookInput>,
  res: MedusaResponse
): Promise<void> {
  const input = req.validatedBody as CreateShopByLookInput;
  const site = await siteFromRequest(req);

  // El look nace en la tienda activa salvo que el cuerpo declare canales.
  const defaults =
    input.sales_channel_ids === undefined ? siteDefaults(site, SHOP_BY_LOOK_SITE_SCOPE) : {};

  const { result } = await createShopByLookWorkflow(req.scope).run({
    input: { ...input, ...defaults },
  });

  res.status(201).json({ shop_by_look: result });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: ShopByLookModuleService = req.scope.resolve(SHOP_BY_LOOK_MODULE);
  const site = await siteFromRequest(req);

  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const filters: Record<string, unknown> = {};
  if (q) {
    filters.$or = [
      { title: { $ilike: `%${q}%` } },
      { subtitle: { $ilike: `%${q}%` } },
    ];
  }

  // Dentro de listAndCount: filtrar el resultado daría un count desalineado.
  Object.assign(filters, await siteFilter(req.scope, site, SHOP_BY_LOOK_SITE_SCOPE));

  const [shop_by_looks, count] = await service.listAndCountShopByLooks(filters, {
    skip: offset,
    take: limit,
    relations: ['products'],
    order: { sort_order: 'ASC', created_at: 'DESC' },
  });

  res.status(200).json({ shop_by_looks, count, offset, limit });
}
