import { z } from 'zod';
export declare const PostAdminCreateBlogCategory: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    image: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        file_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$loose>>>;
    sort_order: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const PostAdminUpdateBlogCategory: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    image: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        file_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$loose>>>;
    sort_order: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
