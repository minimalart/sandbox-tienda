import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
import { SHOP_BY_LOOK_MODULE } from '../../../../modules/shop-by-look';
import ShopByLookModuleService from '../../../../modules/shop-by-look/service';
import { PLACEMENTS, ShopByLookProductSchema } from '../route';
import { siteFromRequest, assertRowInSite } from '../../../../lib/multistore';
import { SHOP_BY_LOOK_SITE_SCOPE } from '../../../../modules/shop-by-look/site-scope';

export const UpdateShopByLookSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  cta_label: z.string().nullable().optional(),
  image_url: z.string().min(1).optional(),
  image_alt: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  placement: z.enum(PLACEMENTS).optional(),
  sales_channel_ids: z.array(z.string()).nullable().optional(),
  region_ids: z.array(z.string()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  // Cuando se envía `products`, REEMPLAZA toda la lista de hotspots del look.
  products: z.array(ShopByLookProductSchema).optional(),
});

type UpdateShopByLookInput = z.infer<typeof UpdateShopByLookSchema>;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const look_id = req.params.look_id as string;
  const service: ShopByLookModuleService = req.scope.resolve(SHOP_BY_LOOK_MODULE);

  const shop_by_look = await service.retrieveShopByLook(look_id, {
    relations: ['products'],
  });
  assertRowInSite(shop_by_look as Record<string, unknown>, await siteFromRequest(req), SHOP_BY_LOOK_SITE_SCOPE);

  res.status(200).json({ shop_by_look });
}

export async function POST(
  req: MedusaRequest<UpdateShopByLookInput>,
  res: MedusaResponse
): Promise<void> {
  const look_id = req.params.look_id as string;
  const input = req.validatedBody as UpdateShopByLookInput;
  const service: ShopByLookModuleService = req.scope.resolve(SHOP_BY_LOOK_MODULE);

  const { products, ...lookData } = input;

  // model.json() tipa los arrays (sales_channel_ids/region_ids) como
  // Record<string, unknown>; el cast evita el falso conflicto de tipos.
  assertRowInSite(
    (await service.retrieveShopByLook(look_id)) as Record<string, unknown>,
    await siteFromRequest(req),
    SHOP_BY_LOOK_SITE_SCOPE,
  );

  await service.updateShopByLooks({ id: look_id, ...lookData } as any);

  // Reemplazo completo de los hotspots cuando el cliente manda `products`.
  if (products !== undefined) {
    const existing = await service.listShopByLookProducts({ look_id });
    if (existing.length) {
      await service.deleteShopByLookProducts(existing.map((e) => e.id));
    }
    if (products.length) {
      await service.createShopByLookProducts(
        products.map((p) => ({
          product_id: p.product_id,
          variant_id: p.variant_id ?? null,
          pos_x: p.pos_x ?? 50,
          pos_y: p.pos_y ?? 50,
          sort_order: p.sort_order ?? 0,
          look_id,
        }))
      );
    }
  }

  const shop_by_look = await service.retrieveShopByLook(look_id, {
    relations: ['products'],
  });

  res.status(200).json({ shop_by_look });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const look_id = req.params.look_id as string;
  const service: ShopByLookModuleService = req.scope.resolve(SHOP_BY_LOOK_MODULE);

  assertRowInSite(
    (await service.retrieveShopByLook(look_id)) as Record<string, unknown>,
    await siteFromRequest(req),
    SHOP_BY_LOOK_SITE_SCOPE,
  );

  await service.deleteShopByLooks(look_id);

  res.status(200).json({ id: look_id, deleted: true });
}
