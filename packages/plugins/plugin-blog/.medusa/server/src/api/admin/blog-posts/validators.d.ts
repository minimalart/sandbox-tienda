import { z } from 'zod';
export declare const PostAdminCreateBlogPost: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    excerpt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cover_image: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        file_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$loose>>>;
    content: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodArray<z.ZodAny>>;
    }, z.core.$loose>>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo_title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo_description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const PostAdminUpdateBlogPost: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    excerpt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    cover_image: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        url: z.ZodString;
        file_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        alt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, z.core.$loose>>>;
    content: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodString>;
        content: z.ZodOptional<z.ZodArray<z.ZodAny>>;
    }, z.core.$loose>>>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
    }>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo_title: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo_description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const PostAdminSetBlogPostProducts: z.ZodObject<{
    product_ids: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PostAdminCreateBlogPostInput = z.infer<typeof PostAdminCreateBlogPost>;
export type PostAdminUpdateBlogPostInput = z.infer<typeof PostAdminUpdateBlogPost>;
