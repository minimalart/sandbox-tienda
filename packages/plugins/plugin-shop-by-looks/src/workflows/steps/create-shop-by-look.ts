import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { SHOP_BY_LOOK_MODULE } from '../../modules/shop-by-look';
import ShopByLookModuleService from '../../modules/shop-by-look/service';

export type ShopByLookProductInput = {
  product_id: string;
  variant_id?: string | null;
  pos_x?: number;
  pos_y?: number;
  sort_order?: number;
};

export type CreateShopByLookStepInput = {
  title: string;
  subtitle?: string | null;
  cta_label?: string | null;
  image_url: string;
  image_alt?: string | null;
  is_active?: boolean;
  sort_order?: number;
  placement?: string;
  sales_channel_ids?: string[] | null;
  region_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
  products?: ShopByLookProductInput[];
};

export const createShopByLookStep = createStep(
  'create-shop-by-look-step',
  async (input: CreateShopByLookStepInput, { container }) => {
    const service: ShopByLookModuleService = container.resolve(SHOP_BY_LOOK_MODULE);

    const { products, ...lookData } = input;

    // model.json() tipa los arrays (sales_channel_ids/region_ids) como
    // Record<string, unknown>; el cast evita el falso conflicto de tipos.
    const look = await service.createShopByLooks(lookData as any);

    if (products?.length) {
      await service.createShopByLookProducts(
        products.map((p) => ({
          product_id: p.product_id,
          variant_id: p.variant_id ?? null,
          pos_x: p.pos_x ?? 50,
          pos_y: p.pos_y ?? 50,
          sort_order: p.sort_order ?? 0,
          look_id: look.id,
        }))
      );
    }

    const created = await service.retrieveShopByLook(look.id, {
      relations: ['products'],
    });

    return new StepResponse(created, look.id);
  },
  async (lookId, { container }) => {
    if (!lookId) {
      return;
    }
    const service: ShopByLookModuleService = container.resolve(SHOP_BY_LOOK_MODULE);
    // FK on delete cascade removes child products.
    await service.deleteShopByLooks(lookId);
  }
);
