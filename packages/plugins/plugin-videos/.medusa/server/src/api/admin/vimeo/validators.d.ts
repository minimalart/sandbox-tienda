import { z } from 'zod';
export declare const AdminVimeoOAuthStartQuery: z.ZodObject<{
    redirect_to: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminVimeoOAuthStartQueryType = z.infer<typeof AdminVimeoOAuthStartQuery>;
export declare const AdminVimeoOAuthCallbackQuery: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    error_description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminVimeoOAuthCallbackQueryType = z.infer<typeof AdminVimeoOAuthCallbackQuery>;
export declare const AdminVimeoUploadBody: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    file_size: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type AdminVimeoUploadBodyType = z.infer<typeof AdminVimeoUploadBody>;
export declare const AdminVimeoSearchQuery: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    page: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    per_page: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type AdminVimeoSearchQueryType = z.infer<typeof AdminVimeoSearchQuery>;
