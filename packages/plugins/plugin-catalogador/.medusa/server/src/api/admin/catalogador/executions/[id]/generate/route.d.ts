import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const GenerateExecutionSchema: z.ZodObject<{
    product_ids: z.ZodOptional<z.ZodArray<z.ZodString>>;
    only_failed: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
type GenerateInput = z.infer<typeof GenerateExecutionSchema>;
/**
 * POST /admin/catalogador/executions/:id/generate
 *
 * Marca la ejecución como `generating` y congela la config efectiva usada
 * (PRD §14.1). El procesamiento real corre en segundo plano (job
 * catalogador-process) para que el usuario pueda abandonar la pantalla
 * (PRD §14.1). No genera nada de forma síncrona.
 */
export declare function POST(req: MedusaRequest<GenerateInput>, res: MedusaResponse): Promise<void>;
export {};
