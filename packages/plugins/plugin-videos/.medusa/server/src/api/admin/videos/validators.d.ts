import { z } from 'zod';
export declare const AdminCreateVideoSchema: z.ZodObject<{
    vimeo_id: z.ZodString;
    vimeo_uri: z.ZodString;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    thumbnail_url: z.ZodOptional<z.ZodString>;
    poster_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vimeo_url: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<{
        uploading: "uploading";
        transcoding: "transcoding";
        processing: "processing";
        available: "available";
        error: "error";
        quota_exceeded: "quota_exceeded";
        total_cap_exceeded: "total_cap_exceeded";
        transcode_starting: "transcode_starting";
        unavailable: "unavailable";
    }>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    show_in_carousel: z.ZodOptional<z.ZodBoolean>;
    sort_order: z.ZodOptional<z.ZodNumber>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type AdminCreateVideoType = z.infer<typeof AdminCreateVideoSchema>;
export declare const AdminUpdateVideoSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    thumbnail_url: z.ZodOptional<z.ZodString>;
    poster_url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    vimeo_url: z.ZodOptional<z.ZodString>;
    duration: z.ZodOptional<z.ZodNumber>;
    status: z.ZodOptional<z.ZodEnum<{
        uploading: "uploading";
        transcoding: "transcoding";
        processing: "processing";
        available: "available";
        error: "error";
        quota_exceeded: "quota_exceeded";
        total_cap_exceeded: "total_cap_exceeded";
        transcode_starting: "transcode_starting";
        unavailable: "unavailable";
    }>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    show_in_carousel: z.ZodOptional<z.ZodBoolean>;
    sort_order: z.ZodOptional<z.ZodNumber>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export type AdminUpdateVideoType = z.infer<typeof AdminUpdateVideoSchema>;
export declare const AdminLinkProductsSchema: z.ZodObject<{
    product_ids: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AdminLinkProductsType = z.infer<typeof AdminLinkProductsSchema>;
export declare const AdminUnlinkProductsSchema: z.ZodObject<{
    product_ids: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AdminUnlinkProductsType = z.infer<typeof AdminUnlinkProductsSchema>;
