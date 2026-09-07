import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const CreateBrandSchema: z.ZodObject<{
    name: z.ZodString;
    handle: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    is_active: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export declare function POST(req: MedusaRequest<CreateBrandInput>, res: MedusaResponse): Promise<void>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
