import { z } from 'zod';

const emptyStringToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const itemSchema = z.object({
  variant_id: z.string().min(1, 'variant_id is required'),
  quantity: z.number().int().min(1, 'quantity must be at least 1'),
});

const addressSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  address_1: z.string().optional(),
  address_2: z.string().optional(),
  company: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  country_code: z.string().optional(),
  province: z.string().optional(),
  phone: z.string().optional(),
});

export const PostAdminCreateCheckoutLink = z.object({
  internal_name: z.preprocess(emptyStringToUndefined, z.string().optional()),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
  country_code: z.string().min(1, 'country_code is required').trim(),
  region_id: z.preprocess(emptyStringToUndefined, z.string().optional()),
  sales_channel_id: z.preprocess(emptyStringToUndefined, z.string().optional()),
  email: z.preprocess(emptyStringToUndefined, z.string().email().optional()),
  customer_id: z.preprocess(emptyStringToUndefined, z.string().optional()),
  shipping_address: addressSchema.optional().nullable(),
  promo_codes: z.array(z.string()).optional().nullable(),
  single_use: z.boolean().optional().default(false),
  expires_at: z.preprocess(emptyStringToUndefined, z.string().optional().nullable()),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PostAdminUpdateCheckoutLink = z.object({
  internal_name: z.preprocess(emptyStringToUndefined, z.string().optional()),
  items: z.array(itemSchema).min(1).optional(),
  country_code: z.preprocess(emptyStringToUndefined, z.string().optional()),
  region_id: z.preprocess(emptyStringToUndefined, z.string().optional()),
  sales_channel_id: z.preprocess(emptyStringToUndefined, z.string().optional()),
  email: z.preprocess(
    emptyStringToUndefined,
    z.string().email().optional().nullable(),
  ),
  customer_id: z.preprocess(
    emptyStringToUndefined,
    z.string().optional().nullable(),
  ),
  shipping_address: addressSchema.optional().nullable(),
  promo_codes: z.array(z.string()).optional().nullable(),
  status: z.preprocess(
    emptyStringToUndefined,
    z.enum(['active', 'used', 'disabled']).optional(),
  ),
  single_use: z.boolean().optional(),
  expires_at: z.preprocess(emptyStringToUndefined, z.string().optional().nullable()),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
