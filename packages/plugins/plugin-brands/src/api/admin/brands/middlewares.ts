import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { z } from 'zod';
import { CreateBrandImagesSchema } from './[brand_id]/images/route';
import { UpdateBrandSchema } from './[brand_id]/route';
import { CreateBrandSchema } from './route';

const BulkBrandSchema = z.object({
  items: z
    .array(
      z.object({
        product_handle: z.string().optional().default(''),
        variant_sku: z.string().optional().default(''),
        brand_handle: z.string().min(1, 'Brand handle is required'),
      })
    )
    .min(1, 'At least one item is required'),
});

const LinkProductsSchema = z.object({
  product_ids: z.array(z.string()).min(1, 'At least one product ID is required'),
});

const UnlinkProductsSchema = z.object({
  product_ids: z.array(z.string()).min(1, 'At least one product ID is required'),
});

export const adminBrandsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/brands/bulk',
    method: ['POST'],
    middlewares: [validateAndTransformBody(BulkBrandSchema)],
  },
  {
    matcher: '/admin/brands',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateBrandSchema)],
  },
  {
    matcher: '/admin/brands/:brand_id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateBrandSchema)],
  },
  {
    matcher: '/admin/brands/:brand_id/images',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateBrandImagesSchema)],
  },
  {
    matcher: '/admin/brands/:brand_id/products',
    method: ['POST'],
    middlewares: [validateAndTransformBody(LinkProductsSchema)],
  },
  {
    matcher: '/admin/brands/:brand_id/products',
    method: ['DELETE'],
    middlewares: [validateAndTransformBody(UnlinkProductsSchema)],
  },
];
