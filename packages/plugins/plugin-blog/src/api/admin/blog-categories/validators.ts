import { z } from 'zod';

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (a-z, 0-9, hyphens)');

const imageSchema = z
  .object({
    url: z.string(),
    file_id: z.string().optional().nullable(),
    alt: z.string().optional().nullable(),
  })
  .passthrough();

export const PostAdminCreateBlogCategory = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  slug: slugSchema.optional(),
  description: z.string().optional().nullable(),
  image: imageSchema.optional().nullable(),
  sort_order: z.number().int().optional(),
});

export const PostAdminUpdateBlogCategory = z.object({
  name: z.string().min(1).trim().optional(),
  slug: slugSchema.optional(),
  description: z.string().optional().nullable(),
  image: imageSchema.optional().nullable(),
  sort_order: z.number().int().optional(),
});
