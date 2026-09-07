import { z } from 'zod';

export const StoreListCommentsSchema = z.object({
  commentable_type: z.enum(['product', 'blog_post']),
  commentable_id: z.string().min(1),
});
export type StoreListCommentsType = z.infer<typeof StoreListCommentsSchema>;

export const StoreCreateCommentSchema = z.object({
  commentable_type: z.enum(['product', 'blog_post']),
  commentable_id: z.string().min(1),
  rating: z.number().int().optional(),
  content: z.string().optional(),
});
export type StoreCreateCommentType = z.infer<typeof StoreCreateCommentSchema>;

export const StoreReplyCommentSchema = z.object({
  content: z.string().min(1),
});
export type StoreReplyCommentType = z.infer<typeof StoreReplyCommentSchema>;

export const StoreUpdateCommentSchema = z.object({
  rating: z.number().int().optional(),
  content: z.string().optional(),
});
export type StoreUpdateCommentType = z.infer<typeof StoreUpdateCommentSchema>;
