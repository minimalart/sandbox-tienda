import { z } from 'zod';

export const AdminVimeoOAuthStartQuery = z.object({
  redirect_to: z.string().optional(),
});

export type AdminVimeoOAuthStartQueryType = z.infer<typeof AdminVimeoOAuthStartQuery>;

export const AdminVimeoOAuthCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type AdminVimeoOAuthCallbackQueryType = z.infer<typeof AdminVimeoOAuthCallbackQuery>;

export const AdminVimeoUploadBody = z.object({
  title: z.string(),
  description: z.string().optional(),
  file_size: z.number().optional(),
});

export type AdminVimeoUploadBodyType = z.infer<typeof AdminVimeoUploadBody>;

export const AdminVimeoSearchQuery = z.object({
  query: z.string().optional(),
  page: z.coerce.number().optional(),
  per_page: z.coerce.number().optional(),
});

export type AdminVimeoSearchQueryType = z.infer<typeof AdminVimeoSearchQuery>;
