import { z } from 'zod';
/**
 * Fuente de verdad del schema de `puck_data` para el generador AI, los
 * validators de las APIs y la sanitización previa a guardar.
 *
 * IMPORTANTE: estos componentes y props deben mantenerse EN SYNC con:
 *   - apps/backend/src/admin/lib/puck/config.tsx (editor)
 *   - apps/storefront/src/modules/landing-page/components/landing-renderer.tsx
 *
 * No renombrar componentes existentes sin migración/backward-compat.
 */
export declare const ALLOWED_PUCK_COMPONENTS: readonly ["Hero", "RichText", "ImageBlock", "CTA", "FAQ", "Testimonials", "CollectionGrid", "ProductGrid", "ProductsList", "Spacer"];
export type AllowedPuckComponent = (typeof ALLOWED_PUCK_COMPONENTS)[number];
export declare const EMPTY_PUCK_DATA: {
    readonly content: readonly [];
    readonly root: {
        readonly props: {};
    };
};
/** Schema de props por componente (para sanitizar/normalizar). */
export declare const COMPONENT_PROP_SCHEMAS: Record<AllowedPuckComponent, z.ZodTypeAny>;
/** Un bloque Puck válido (discriminado por `type`). */
export declare const PuckBlockSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"Hero">;
    props: z.ZodObject<{
        accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        subtitle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        image: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        ctaHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"RichText">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        text: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ImageBlock">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        src: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        alt: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        caption: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"CTA">;
    props: z.ZodObject<{
        accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        description: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        buttonLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        buttonHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"FAQ">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            q: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            a: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"Testimonials">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            quote: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            author: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"CollectionGrid">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            label: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            handle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ProductGrid">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"ProductsList">;
    props: z.ZodObject<{
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        source: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
            query: "query";
            category: "category";
            collection: "collection";
            tag: "tag";
            promotions: "promotions";
            newest: "newest";
        }>>>;
        value: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        limit: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
        sortBy: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
            "": "";
            created_at: "created_at";
            price_asc: "price_asc";
            price_desc: "price_desc";
            relevance: "relevance";
        }>>>;
        ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"Spacer">;
    props: z.ZodObject<{
        size: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
        background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>], "type">;
/** Estructura completa de `puck_data`. */
export declare const PuckDataSchema: z.ZodObject<{
    content: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"Hero">;
        props: z.ZodObject<{
            accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            subtitle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            image: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"RichText">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            text: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ImageBlock">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            src: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            alt: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            caption: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CTA">;
        props: z.ZodObject<{
            accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            description: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            buttonLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            buttonHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"FAQ">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                q: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                a: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"Testimonials">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                quote: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                author: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CollectionGrid">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                label: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                handle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ProductGrid">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ProductsList">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            source: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
                query: "query";
                category: "category";
                collection: "collection";
                tag: "tag";
                promotions: "promotions";
                newest: "newest";
            }>>>;
            value: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            limit: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
            sortBy: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
                "": "";
                created_at: "created_at";
                price_asc: "price_asc";
                price_desc: "price_desc";
                relevance: "relevance";
            }>>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"Spacer">;
        props: z.ZodObject<{
            size: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>>;
    root: z.ZodDefault<z.ZodObject<{
        props: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    zones: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"Hero">;
        props: z.ZodObject<{
            accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            subtitle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            image: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"RichText">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            text: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ImageBlock">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            src: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            alt: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            caption: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CTA">;
        props: z.ZodObject<{
            accentColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            title: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            description: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            buttonLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            buttonHref: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"FAQ">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                q: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                a: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"Testimonials">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                quote: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                author: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"CollectionGrid">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            items: z.ZodDefault<z.ZodArray<z.ZodObject<{
                label: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                handle: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
                href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ProductGrid">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"ProductsList">;
        props: z.ZodObject<{
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            textColor: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            heading: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            source: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
                query: "query";
                category: "category";
                collection: "collection";
                tag: "tag";
                promotions: "promotions";
                newest: "newest";
            }>>>;
            value: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            limit: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
            sortBy: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodDefault<z.ZodEnum<{
                "": "";
                created_at: "created_at";
                price_asc: "price_asc";
                price_desc: "price_desc";
                relevance: "relevance";
            }>>>;
            ctaLabel: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
            href: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"Spacer">;
        props: z.ZodObject<{
            size: z.ZodPipe<z.ZodTransform<number, unknown>, z.ZodDefault<z.ZodNumber>>;
            background: z.ZodPipe<z.ZodTransform<string, unknown>, z.ZodDefault<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>], "type">>>>;
}, z.core.$strip>;
export type PuckBlock = z.infer<typeof PuckBlockSchema>;
export type PuckData = z.infer<typeof PuckDataSchema>;
/**
 * Punto de entrada para limpiar cualquier `puck_data` (venga del editor humano
 * o del generador AI). NUNCA lanza: devuelve siempre una estructura válida y
 * segura, descartando lo que no se reconoce. Mantiene `root.props` aunque esté
 * vacío y valida `zones` con el mismo criterio.
 */
export declare function sanitizePuckData(input: unknown): PuckData;
