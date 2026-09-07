import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const ReviewProductSchema: z.ZodObject<{
    action: z.ZodEnum<{
        field: "field";
        accept_all: "accept_all";
        reject_all: "reject_all";
        exclude: "exclude";
        include: "include";
    }>;
    field: z.ZodOptional<z.ZodString>;
    decision: z.ZodOptional<z.ZodEnum<{
        accept: "accept";
        reject: "reject";
        edit: "edit";
        keep: "keep";
    }>>;
    value: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
type ReviewInput = z.infer<typeof ReviewProductSchema>;
/**
 * POST /admin/catalogador/executions/:id/products/:pid
 *
 * Acciones de revisión por producto/campo (PRD §15.3/§15.4). No aplica cambios
 * al catálogo: sólo registra las DECISIONES del usuario sobre las propuestas.
 * La aplicación real la hace /apply (PRD §18.2).
 */
export declare function POST(req: MedusaRequest<ReviewInput>, res: MedusaResponse): Promise<void>;
export {};
