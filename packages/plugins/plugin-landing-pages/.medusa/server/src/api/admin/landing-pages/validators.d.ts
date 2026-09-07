import { z } from 'zod';
export declare const PostAdminCreateLandingPage: z.ZodObject<{
    title: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
        noindex: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    puck_data: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodObject<{
        content: z.ZodOptional<z.ZodArray<z.ZodAny>>;
        root: z.ZodOptional<z.ZodObject<{
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.core.$loose>>;
        zones: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.core.$loose>, z.ZodTransform<{
        content: ({
            type: "Hero";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                subtitle: string;
                image: string;
                ctaLabel: string;
                ctaHref: string;
            };
        } | {
            type: "RichText";
            props: {
                background: string;
                textColor: string;
                heading: string;
                text: string;
            };
        } | {
            type: "ImageBlock";
            props: {
                background: string;
                textColor: string;
                src: string;
                alt: string;
                caption: string;
            };
        } | {
            type: "CTA";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                description: string;
                buttonLabel: string;
                buttonHref: string;
            };
        } | {
            type: "FAQ";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    q: string;
                    a: string;
                }[];
            };
        } | {
            type: "Testimonials";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    quote: string;
                    author: string;
                }[];
            };
        } | {
            type: "CollectionGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    label: string;
                    handle: string;
                    href: string;
                }[];
            };
        } | {
            type: "ProductGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                href: string;
                ctaLabel: string;
            };
        } | {
            type: "ProductsList";
            props: {
                background: string;
                textColor: string;
                heading: string;
                source: "query" | "category" | "collection" | "tag" | "promotions" | "newest";
                value: string;
                limit: number;
                sortBy: "" | "created_at" | "price_asc" | "price_desc" | "relevance";
                ctaLabel: string;
                href: string;
            };
        } | {
            type: "Spacer";
            props: {
                size: number;
                background: string;
            };
        })[];
        root: {
            props: Record<string, unknown>;
        };
        zones?: Record<string, ({
            type: "Hero";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                subtitle: string;
                image: string;
                ctaLabel: string;
                ctaHref: string;
            };
        } | {
            type: "RichText";
            props: {
                background: string;
                textColor: string;
                heading: string;
                text: string;
            };
        } | {
            type: "ImageBlock";
            props: {
                background: string;
                textColor: string;
                src: string;
                alt: string;
                caption: string;
            };
        } | {
            type: "CTA";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                description: string;
                buttonLabel: string;
                buttonHref: string;
            };
        } | {
            type: "FAQ";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    q: string;
                    a: string;
                }[];
            };
        } | {
            type: "Testimonials";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    quote: string;
                    author: string;
                }[];
            };
        } | {
            type: "CollectionGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    label: string;
                    handle: string;
                    href: string;
                }[];
            };
        } | {
            type: "ProductGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                href: string;
                ctaLabel: string;
            };
        } | {
            type: "ProductsList";
            props: {
                background: string;
                textColor: string;
                heading: string;
                source: "query" | "category" | "collection" | "tag" | "promotions" | "newest";
                value: string;
                limit: number;
                sortBy: "" | "created_at" | "price_asc" | "price_desc" | "relevance";
                ctaLabel: string;
                href: string;
            };
        } | {
            type: "Spacer";
            props: {
                size: number;
                background: string;
            };
        })[]> | undefined;
    }, {
        [x: string]: unknown;
        content?: any[] | undefined;
        root?: {
            [x: string]: unknown;
            props?: Record<string, any> | undefined;
        } | undefined;
        zones?: Record<string, any> | undefined;
    }>>>>;
    template: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locale: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sales_channel_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export declare const PostAdminUpdateLandingPage: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        published: "published";
        archived: "archived";
    }>>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    seo: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        image: z.ZodOptional<z.ZodString>;
        noindex: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    puck_data: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodObject<{
        content: z.ZodOptional<z.ZodArray<z.ZodAny>>;
        root: z.ZodOptional<z.ZodObject<{
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, z.core.$loose>>;
        zones: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, z.core.$loose>, z.ZodTransform<{
        content: ({
            type: "Hero";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                subtitle: string;
                image: string;
                ctaLabel: string;
                ctaHref: string;
            };
        } | {
            type: "RichText";
            props: {
                background: string;
                textColor: string;
                heading: string;
                text: string;
            };
        } | {
            type: "ImageBlock";
            props: {
                background: string;
                textColor: string;
                src: string;
                alt: string;
                caption: string;
            };
        } | {
            type: "CTA";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                description: string;
                buttonLabel: string;
                buttonHref: string;
            };
        } | {
            type: "FAQ";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    q: string;
                    a: string;
                }[];
            };
        } | {
            type: "Testimonials";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    quote: string;
                    author: string;
                }[];
            };
        } | {
            type: "CollectionGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    label: string;
                    handle: string;
                    href: string;
                }[];
            };
        } | {
            type: "ProductGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                href: string;
                ctaLabel: string;
            };
        } | {
            type: "ProductsList";
            props: {
                background: string;
                textColor: string;
                heading: string;
                source: "query" | "category" | "collection" | "tag" | "promotions" | "newest";
                value: string;
                limit: number;
                sortBy: "" | "created_at" | "price_asc" | "price_desc" | "relevance";
                ctaLabel: string;
                href: string;
            };
        } | {
            type: "Spacer";
            props: {
                size: number;
                background: string;
            };
        })[];
        root: {
            props: Record<string, unknown>;
        };
        zones?: Record<string, ({
            type: "Hero";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                subtitle: string;
                image: string;
                ctaLabel: string;
                ctaHref: string;
            };
        } | {
            type: "RichText";
            props: {
                background: string;
                textColor: string;
                heading: string;
                text: string;
            };
        } | {
            type: "ImageBlock";
            props: {
                background: string;
                textColor: string;
                src: string;
                alt: string;
                caption: string;
            };
        } | {
            type: "CTA";
            props: {
                accentColor: string;
                background: string;
                textColor: string;
                title: string;
                description: string;
                buttonLabel: string;
                buttonHref: string;
            };
        } | {
            type: "FAQ";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    q: string;
                    a: string;
                }[];
            };
        } | {
            type: "Testimonials";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    quote: string;
                    author: string;
                }[];
            };
        } | {
            type: "CollectionGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                items: {
                    label: string;
                    handle: string;
                    href: string;
                }[];
            };
        } | {
            type: "ProductGrid";
            props: {
                background: string;
                textColor: string;
                heading: string;
                href: string;
                ctaLabel: string;
            };
        } | {
            type: "ProductsList";
            props: {
                background: string;
                textColor: string;
                heading: string;
                source: "query" | "category" | "collection" | "tag" | "promotions" | "newest";
                value: string;
                limit: number;
                sortBy: "" | "created_at" | "price_asc" | "price_desc" | "relevance";
                ctaLabel: string;
                href: string;
            };
        } | {
            type: "Spacer";
            props: {
                size: number;
                background: string;
            };
        })[]> | undefined;
    }, {
        [x: string]: unknown;
        content?: any[] | undefined;
        root?: {
            [x: string]: unknown;
            props?: Record<string, any> | undefined;
        } | undefined;
        zones?: Record<string, any> | undefined;
    }>>>>;
    template: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    locale: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sales_channel_id: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
}, z.core.$strip>;
export type PostAdminCreateLandingPageInput = z.infer<typeof PostAdminCreateLandingPage>;
export type PostAdminUpdateLandingPageInput = z.infer<typeof PostAdminUpdateLandingPage>;
