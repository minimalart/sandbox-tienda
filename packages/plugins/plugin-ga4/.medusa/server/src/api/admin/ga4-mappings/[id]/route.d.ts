import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdateGa4MappingSchema: z.ZodObject<{
    medusa_event: z.ZodOptional<z.ZodString>;
    ga4_event_name: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    description: z.ZodOptional<z.ZodString>;
    param_mappings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        ga4_param: z.ZodString;
        source_path: z.ZodOptional<z.ZodString>;
        static_value: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
type UpdateGa4MappingInput = z.infer<typeof UpdateGa4MappingSchema>;
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<UpdateGa4MappingInput>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
