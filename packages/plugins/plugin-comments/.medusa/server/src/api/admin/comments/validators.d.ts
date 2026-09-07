import { z } from 'zod';
export declare const AdminListCommentsSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        hidden: "hidden";
        deleted: "deleted";
    }>>;
    commentable_type: z.ZodOptional<z.ZodEnum<{
        product: "product";
        blog_post: "blog_post";
    }>>;
    commentable_id: z.ZodOptional<z.ZodString>;
    customer_id: z.ZodOptional<z.ZodString>;
    created_from: z.ZodOptional<z.ZodString>;
    created_to: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    offset: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type AdminListCommentsType = z.infer<typeof AdminListCommentsSchema>;
export declare const AdminUpdateCommentSettingsSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    review_mode: z.ZodOptional<z.ZodEnum<{
        comment: "comment";
        rating: "rating";
        both: "both";
    }>>;
    rating_scale: z.ZodOptional<z.ZodNumber>;
    who_can_comment: z.ZodOptional<z.ZodEnum<{
        verified_buyer: "verified_buyer";
        registered: "registered";
    }>>;
    moderation: z.ZodOptional<z.ZodEnum<{
        auto: "auto";
        manual: "manual";
    }>>;
    edit_window_minutes: z.ZodOptional<z.ZodNumber>;
    min_length: z.ZodOptional<z.ZodNumber>;
    max_length: z.ZodOptional<z.ZodNumber>;
    rate_limit_per_minute: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type AdminUpdateCommentSettingsType = z.infer<typeof AdminUpdateCommentSettingsSchema>;
