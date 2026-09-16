import { z } from 'zod';

const emptyStringToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/** Accepts any string `Date.parse` understands (full ISO or datetime-local). */
const isoDateString = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Must be a valid ISO date' });

export const currencyCodeSchema = z.enum(['ars', 'usd', 'eur']);

const amountSchema = z
  .number({ error: 'Amount is required' })
  .int('Amount must be an integer')
  .positive('Amount must be greater than 0');

/**
 * POST /admin/store-config/minimum-purchase — a new record in the history.
 */
export const PostAdminCreateMinimumPurchase = z
  .object({
    amount: amountSchema,
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

/**
 * POST /admin/store-config/minimum-purchase/:id — edit an existing record.
 *
 * Every field is optional: the route merges the body over the stored row and
 * checks `ends_at > starts_at` on the MERGED values, because either side may be
 * the one that did not change. `ends_at: null` clears the end date (open-ended);
 * an empty string means the same thing from a form.
 */
export const PostAdminUpdateMinimumPurchase = z
  .object({
    amount: amountSchema.optional(),
    currency_code: currencyCodeSchema.optional(),
    starts_at: isoDateString.optional(),
    ends_at: z.preprocess(emptyStringToUndefined, isoDateString.optional().nullable()),
    note: z.preprocess(emptyStringToUndefined, z.string().optional().nullable()),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export type AdminUpdateMinimumPurchaseInput = z.infer<typeof PostAdminUpdateMinimumPurchase>;
