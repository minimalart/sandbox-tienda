import { z } from 'zod';

const emptyStringToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/** Accepts any string `Date.parse` understands (full ISO or datetime-local). */
const isoDateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date' });

export const currencyCodeSchema = z.enum(['ars', 'usd', 'eur']);

/**
 * POST /admin/store-config/minimum-purchase
 *
 * APPEND-ONLY: there is intentionally no update/delete schema — every change
 * to the minimum purchase is a new record (auditable history).
 */
export const PostAdminCreateMinimumPurchase = z
  .object({
    amount: z
      .number({ error: 'Amount is required' })
      .int('Amount must be an integer')
      .positive('Amount must be greater than 0'),
    currency_code: currencyCodeSchema.optional(),
    starts_at: isoDateString,
    ends_at: z.preprocess(emptyStringToUndefined, isoDateString.optional().nullable()),
    note: z.preprocess(emptyStringToUndefined, z.string().optional().nullable()),
  })
  .refine(
    (data) => !data.ends_at || Date.parse(data.ends_at) > Date.parse(data.starts_at),
    { message: 'ends_at must be after starts_at', path: ['ends_at'] },
  );

export type AdminCreateMinimumPurchaseInput = z.infer<typeof PostAdminCreateMinimumPurchase>;
