import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
/** Operación elegida en el Paso 2 (campo de texto o de imagen). */
export declare const OperationInputSchema: z.ZodObject<{
    type: z.ZodEnum<{
        text_field: "text_field";
        image_technical: "image_technical";
        image_ai: "image_ai";
    }>;
    field: z.ZodString;
    configuration: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const CreateExecutionSchema: z.ZodObject<{
    name: z.ZodString;
    product_ids: z.ZodArray<z.ZodString>;
    operations: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            text_field: "text_field";
            image_technical: "image_technical";
            image_ai: "image_ai";
        }>;
        field: z.ZodString;
        configuration: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
    selection_definition: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
type CreateExecutionInput = z.infer<typeof CreateExecutionSchema>;
/** GET /admin/catalogador/executions — lista paginada con filtros. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * POST /admin/catalogador/executions — crea una ejecución en borrador con la
 * selección exacta de productos (IDs) y las operaciones elegidas. NO genera
 * propuestas todavía (eso lo dispara /generate). PRD §10-§12.
 */
export declare function POST(req: MedusaRequest<CreateExecutionInput>, res: MedusaResponse): Promise<void>;
export {};
