import { z } from 'zod';

export const AdminListCommentsSchema = z.object({
  status: z.enum(['pending', 'approved', 'hidden', 'deleted']).optional(),
  commentable_type: z.enum(['product', 'blog_post']).optional(),
  commentable_id: z.string().optional(),
  customer_id: z.string().optional(),
  created_from: z.string().optional(),
  created_to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type AdminListCommentsType = z.infer<typeof AdminListCommentsSchema>;

export const AdminUpdateCommentSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  review_mode: z.enum(['comment', 'rating', 'both']).optional(),
  rating_scale: z.number().int().min(2).max(10).optional(),
  who_can_comment: z.enum(['registered', 'verified_buyer']).optional(),
  moderation: z.enum(['auto', 'manual']).optional(),
  edit_window_minutes: z.number().int().min(0).optional(),
  min_length: z.number().int().min(0).optional(),
  max_length: z.number().int().min(1).optional(),
  rate_limit_per_minute: z.number().int().min(1).optional(),
});
export type AdminUpdateCommentSettingsType = z.infer<
  typeof AdminUpdateCommentSettingsSchema
>;
