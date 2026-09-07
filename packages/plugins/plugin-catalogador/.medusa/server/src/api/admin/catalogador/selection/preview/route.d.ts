import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
/**
 * Filtros de selección de productos (Paso 1, PRD §11.2). Sólo trabaja sobre
 * productos EXISTENTES: nunca crea ni importa (PRD §11.3).
 */
export declare const SelectionPreviewSchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    category_id: z.ZodOptional<z.ZodString>;
    collection_id: z.ZodOptional<z.ZodString>;
    tag_id: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        draft: "draft";
        proposed: "proposed";
        rejected: "rejected";
        published: "published";
    }>>;
    missing_field: z.ZodOptional<z.ZodEnum<{
        description: "description";
        subtitle: "subtitle";
        title: "title";
    }>>;
    limit: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
type SelectionPreviewInput = z.infer<typeof SelectionPreviewSchema>;
/** POST /admin/catalogador/selection/preview — resuelve filtros → conteo + muestra. */
export declare function POST(req: MedusaRequest<SelectionPreviewInput>, res: MedusaResponse): Promise<void>;
export {};
