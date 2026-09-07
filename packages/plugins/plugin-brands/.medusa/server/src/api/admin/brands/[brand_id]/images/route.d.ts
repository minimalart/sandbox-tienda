import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const CreateBrandImagesSchema: z.ZodObject<{
    images: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            thumbnail: "thumbnail";
            image: "image";
        }>;
        url: z.ZodString;
        file_id: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
type CreateBrandImagesInput = z.infer<typeof CreateBrandImagesSchema>;
export declare function POST(req: MedusaRequest<CreateBrandImagesInput>, res: MedusaResponse): Promise<void>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
