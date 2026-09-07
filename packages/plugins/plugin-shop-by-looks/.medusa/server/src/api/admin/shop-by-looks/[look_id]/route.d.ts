import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdateShopByLookSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    subtitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cta_label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    image_url: z.ZodOptional<z.ZodString>;
    image_alt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    sort_order: z.ZodOptional<z.ZodNumber>;
    placement: z.ZodOptional<z.ZodEnum<{
        after_featured: "after_featured";
        top: "top";
        after_collections: "after_collections";
        before_footer: "before_footer";
    }>>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    region_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    products: z.ZodOptional<z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        variant_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        pos_x: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pos_y: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        sort_order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
type UpdateShopByLookInput = z.infer<typeof UpdateShopByLookSchema>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<UpdateShopByLookInput>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
