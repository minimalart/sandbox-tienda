import { z } from 'zod';

const emptyStringToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const contentSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
});

const mediaSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
  type: z.enum(['image', 'video']).optional().default('image'),
  aspect_ratio: z.string().optional(),
});

const ctaSchema = z.object({
  label: z.string().optional(),
  url: z.string(),
  target: z.enum(['_self', '_blank']).optional().default('_self'),
});

const rulesSchema = z.object({
  sales_channel_ids: z.array(z.string()).optional(),
  customer_group_ids: z.array(z.string()).optional(),
  locales: z.array(z.string()).optional(),
  countries: z.array(z.string()).optional(),
  devices: z.array(z.enum(['mobile', 'desktop'])).optional(),
  paths: z.array(z.string()).optional(),
});

export const PostAdminCreateBanner = z.object({
  internal_name: z.string().min(2, 'Name must have at least 2 characters').trim(),
  handle: z.preprocess(emptyStringToUndefined, z.string().optional()),
  placement: z.string().min(1, 'Placement is required'),
  type: z.preprocess(emptyStringToUndefined, z.string().optional()),
  device_type: z.preprocess(emptyStringToUndefined, z.string().optional()),
  status: z.preprocess(emptyStringToUndefined, z.enum(['draft', 'published', 'archived']).optional()),
  priority: z.number().min(0).max(999).optional().default(0),
  content: contentSchema.optional().nullable(),
  media: mediaSchema.optional().nullable(),
  cta: ctaSchema.optional().nullable(),
  rules: rulesSchema.optional().nullable(),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PostAdminUpdateBanner = z.object({
  internal_name: z.preprocess(emptyStringToUndefined, z.string().min(2).trim().optional()),
  handle: z.preprocess(emptyStringToUndefined, z.string().optional()),
  placement: z.preprocess(emptyStringToUndefined, z.string().optional()),
  type: z.preprocess(emptyStringToUndefined, z.string().optional()),
  device_type: z.preprocess(emptyStringToUndefined, z.string().optional()),
  status: z.preprocess(emptyStringToUndefined, z.enum(['draft', 'published', 'archived']).optional()),
  priority: z.number().min(0).max(999).optional(),
  content: contentSchema.optional().nullable(),
  media: mediaSchema.optional().nullable(),
  cta: ctaSchema.optional().nullable(),
  rules: rulesSchema.optional().nullable(),
  start_at: z.string().optional().nullable(),
  end_at: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});
