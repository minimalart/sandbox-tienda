import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const PLACEMENTS: readonly ["top", "after_collections", "after_featured", "before_footer"];
export declare const ShopByLookProductSchema: z.ZodObject<{
    product_id: z.ZodString;
    variant_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pos_x: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    pos_y: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    sort_order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const CreateShopByLookSchema: z.ZodObject<{
    title: z.ZodString;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cta_label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    image_url: z.ZodString;
    image_alt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sort_order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    placement: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
        after_featured: "after_featured";
        top: "top";
        after_collections: "after_collections";
        before_footer: "before_footer";
    }>>>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    region_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    products: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        variant_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        pos_x: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pos_y: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        sort_order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
type CreateShopByLookInput = z.infer<typeof CreateShopByLookSchema>;
export declare function POST(req: MedusaRequest<CreateShopByLookInput>, res: MedusaResponse): Promise<void>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
