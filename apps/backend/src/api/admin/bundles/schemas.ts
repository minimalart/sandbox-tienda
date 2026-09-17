import { z } from 'zod';

/**
 * Bundle admin schemas. Kept in a dedicated module (not colocated with the
 * route handlers) for the same reason `admin/sites/schemas.ts` documents:
 * `route.ts` files import type-only exports from `@medusajs/framework/http`
 * that break under the ESM test harness, so schemas need a separate file to
 * remain testable in isolation.
 */

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BundleStatusSchema = z.enum(['draft', 'published']);

export const CreateBundleSchema = z.object({
  title: z.string().min(1),
  handle: z
    .string()
    .min(1)
    .max(80)
    .regex(HANDLE_PATTERN, 'handle debe ser kebab-case (a-z, 0-9, guiones)'),
  description: z.string().max(2000).nullish(),
  thumbnail: z.string().url().nullish(),
  status: BundleStatusSchema.optional().default('draft'),
  metadata: z.record(z.string(), z.unknown()).nullish(),
  store_ids: z.array(z.string().min(1)).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        position: z.number().int().nonnegative().optional(),
      }),
    )
    .optional(),
});
export type CreateBundleInput = z.infer<typeof CreateBundleSchema>;

export const UpdateBundleSchema = CreateBundleSchema.partial().omit({
  handle: true, // renombrar rompe URLs de storefront; se resuelve con delete/recreate
});
export type UpdateBundleInput = z.infer<typeof UpdateBundleSchema>;

export const ListBundlesQuerySchema = z.object({
  q: z.string().optional(),
  status: BundleStatusSchema.optional(),
  store_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ListBundlesQuery = z.infer<typeof ListBundlesQuerySchema>;

export const CreateBundleItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  position: z.number().int().nonnegative().optional(),
});
export type CreateBundleItemInput = z.infer<typeof CreateBundleItemSchema>;

export const UpdateBundleItemSchema = z.object({
  quantity: z.number().int().positive().optional(),
  position: z.number().int().nonnegative().optional(),
});
export type UpdateBundleItemInput = z.infer<typeof UpdateBundleItemSchema>;

export const SetBundleStoresSchema = z.object({
  store_ids: z.array(z.string().min(1)),
});
export type SetBundleStoresInput = z.infer<typeof SetBundleStoresSchema>;
