import { z } from 'zod';
export declare const PostRegisterAsset: z.ZodObject<{
    url: z.ZodString;
    file_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    filename: z.ZodString;
    mime_type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    source: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, z.core.$strip>;
export declare const PutUpdateAsset: z.ZodObject<{
    filename: z.ZodOptional<z.ZodString>;
    alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const PostAttach: z.ZodObject<{
    product_id: z.ZodString;
    asset_ids: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
