import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdatePdfCatalogSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    pdf_url: z.ZodOptional<z.ZodString>;
    pdf_file_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pages: z.ZodOptional<z.ZodNumber>;
    published: z.ZodOptional<z.ZodBoolean>;
    metadata: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    hotspots: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            product: "product";
            video: "video";
            text: "text";
        }>;
        page_index: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pos_x: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        pos_y: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        product_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        variant_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        data: z.ZodOptional<z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        sort_order: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>>>;
    sales_channel_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
type UpdatePdfCatalogInput = z.infer<typeof UpdatePdfCatalogSchema>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<UpdatePdfCatalogInput>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
