import { z } from 'zod';

export const AdminCreateVideoSchema = z.object({
  vimeo_id: z.string(),
  vimeo_uri: z.string(),
  title: z.string(),
  description: z.string().optional(),
  thumbnail_url: z.string().optional(),
  poster_url: z.string().nullable().optional(),
  vimeo_url: z.string().optional(),
  duration: z.number().optional(),
  status: z
    .enum([
      'uploading',
      'transcoding',
      'processing',
      'available',
      'error',
      'quota_exceeded',
      'total_cap_exceeded',
      'transcode_starting',
      'unavailable',
    ])
    .optional(),
  is_active: z.boolean().optional(),
  show_in_carousel: z.boolean().optional(),
  sort_order: z.number().optional(),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type AdminCreateVideoType = z.infer<typeof AdminCreateVideoSchema>;

export const AdminUpdateVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  thumbnail_url: z.string().optional(),
  poster_url: z.string().nullable().optional(),
  vimeo_url: z.string().optional(),
  duration: z.number().optional(),
  status: z
    .enum([
      'uploading',
      'transcoding',
      'processing',
      'available',
      'error',
      'quota_exceeded',
      'total_cap_exceeded',
      'transcode_starting',
      'unavailable',
    ])
    .optional(),
  is_active: z.boolean().optional(),
  show_in_carousel: z.boolean().optional(),
  sort_order: z.number().optional(),
  sales_channel_ids: z.array(z.string()).nullish(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type AdminUpdateVideoType = z.infer<typeof AdminUpdateVideoSchema>;

export const AdminLinkProductsSchema = z.object({
  product_ids: z.array(z.string()),
});

export type AdminLinkProductsType = z.infer<typeof AdminLinkProductsSchema>;

export const AdminUnlinkProductsSchema = z.object({
  product_ids: z.array(z.string()),
});

export type AdminUnlinkProductsType = z.infer<typeof AdminUnlinkProductsSchema>;
