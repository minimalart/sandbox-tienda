import { z } from 'zod';

const statusSchema = z.enum(['draft', 'published']);

// URL-safe slug: lowercase words separated by single hyphens.
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

// Tiptap document — kept permissive (passthrough) so editor upgrades don't
// break persistence; the renderer maps known nodes only.
const contentSchema = z
  .object({
    type: z.string().optional(),
    content: z.array(z.any()).optional(),
  })
  .passthrough();

export const PostAdminCreateBlogPost = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  slug: slugSchema.optional(),
  excerpt: z.string().optional().nullable(),
  cover_image: imageSchema.optional().nullable(),
  content: contentSchema.optional().nullable(),
  status: statusSchema.optional(),
  category_id: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const PostAdminUpdateBlogPost = z.object({
  title: z.string().min(1).trim().optional(),
  slug: slugSchema.optional(),
  excerpt: z.string().optional().nullable(),
  cover_image: imageSchema.optional().nullable(),
  content: contentSchema.optional().nullable(),
  status: statusSchema.optional(),
  category_id: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
});

export const PostAdminSetBlogPostProducts = z.object({
  product_ids: z.array(z.string()),
});

export type PostAdminCreateBlogPostInput = z.infer<typeof PostAdminCreateBlogPost>;
export type PostAdminUpdateBlogPostInput = z.infer<typeof PostAdminUpdateBlogPost>;
