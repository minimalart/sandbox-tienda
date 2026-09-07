import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
/**
 * PATCH /admin/catalogador/executions/:id/assets/:aid/composition (PRD §10).
 *
 * Actualiza ÚNICAMENTE `metadata.composition` de una propuesta lifestyle
 * editable. No genera archivos ni llama a IA (PRD §6.4). El backend aplica los
 * límites del PRD §14 (x/y ∈ [0,1], scale ∈ [MIN,MAX]). El render definitivo se
 * hace al aplicar (PRD §11), no acá.
 */
export declare const UpdateCompositionSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    scale: z.ZodNumber;
}, z.core.$strip>;
type UpdateCompositionInput = z.infer<typeof UpdateCompositionSchema>;
export declare function PATCH(req: MedusaRequest<UpdateCompositionInput>, res: MedusaResponse): Promise<void>;
export {};
