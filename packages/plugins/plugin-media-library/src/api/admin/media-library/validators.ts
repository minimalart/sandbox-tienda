import { z } from 'zod';

export const PostRegisterAsset = z.object({
  url: z.string().min(1),
  file_id: z.string().optional().nullable(),
  filename: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  size: z.number().optional().nullable(),
  alt: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PutUpdateAsset = z.object({
  filename: z.string().min(1).optional(),
  alt: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
});

export const PostAttach = z.object({
  product_id: z.string().min(1),
  asset_ids: z.array(z.string().min(1)).min(1),
});
