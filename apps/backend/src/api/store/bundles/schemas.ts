import { z } from 'zod';

export const ConfirmBundleSchema = z.object({
  bundle_id: z.string().min(1),
  cart_id: z.string().min(1),
  selections: z
    .array(
      z.object({
        bundle_item_id: z.string().min(1),
        variant_id: z.string().min(1),
      }),
    )
    .min(1, 'Al menos una selección es requerida'),
  // Ownership del bundle_instance_id: SIEMPRE server-side. El cliente NO puede
  // proponer un id — se rechaza si viene, para prevenir que dos configuraciones
  // distintas terminen colisionando sobre el mismo grupo.
});
export type ConfirmBundleInput = z.infer<typeof ConfirmBundleSchema>;

export const ListStoreBundlesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ListStoreBundlesQuery = z.infer<typeof ListStoreBundlesQuerySchema>;
