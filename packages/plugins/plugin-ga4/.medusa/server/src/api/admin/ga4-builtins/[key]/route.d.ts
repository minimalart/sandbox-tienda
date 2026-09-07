import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdateGa4BuiltinSchema: z.ZodObject<{
    is_active: z.ZodOptional<z.ZodBoolean>;
    hidden: z.ZodOptional<z.ZodBoolean>;
    ga4_event_name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type UpdateGa4BuiltinInput = z.infer<typeof UpdateGa4BuiltinSchema>;
export declare function POST(req: MedusaRequest<UpdateGa4BuiltinInput>, res: MedusaResponse): Promise<void>;
export {};
