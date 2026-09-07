import { z } from 'zod';

export const GetStoreMercadopagoInstallmentsParams = z.object({
  payment_method_id: z.string(),
  bin: z.string().min(6).max(8),
  amount: z.coerce.number().min(1),
  issuer_id: z.coerce.number().optional(),
  /** Picks the collecting MP account (multi-tenant). Optional — global fallback. */
  sales_channel_id: z.string().optional(),
});

export type GetStoreMercadopagoInstallmentsParamsType = z.infer<
  typeof GetStoreMercadopagoInstallmentsParams
>;
