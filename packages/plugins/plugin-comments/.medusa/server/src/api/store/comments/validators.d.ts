import { z } from 'zod';
export declare const StoreListCommentsSchema: z.ZodObject<{
    commentable_type: z.ZodEnum<{
        product: "product";
        blog_post: "blog_post";
    }>;
    commentable_id: z.ZodString;
}, z.core.$strip>;
export type StoreListCommentsType = z.infer<typeof StoreListCommentsSchema>;
export declare const StoreCreateCommentSchema: z.ZodObject<{
    commentable_type: z.ZodEnum<{
        product: "product";
        blog_post: "blog_post";
    }>;
    commentable_id: z.ZodString;
    rating: z.ZodOptional<z.ZodNumber>;
    content: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StoreCreateCommentType = z.infer<typeof StoreCreateCommentSchema>;
export declare const StoreReplyCommentSchema: z.ZodObject<{
    content: z.ZodString;
}, z.core.$strip>;
export type StoreReplyCommentType = z.infer<typeof StoreReplyCommentSchema>;
export declare const StoreUpdateCommentSchema: z.ZodObject<{
    rating: z.ZodOptional<z.ZodNumber>;
    content: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type StoreUpdateCommentType = z.infer<typeof StoreUpdateCommentSchema>;
