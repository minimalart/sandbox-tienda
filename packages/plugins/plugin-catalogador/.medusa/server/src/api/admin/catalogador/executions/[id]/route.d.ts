import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdateExecutionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** GET /admin/catalogador/executions/:id — detalle con productos/operaciones/actividad. */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/** PATCH /admin/catalogador/executions/:id — renombrar (u otros metadatos livianos). */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/** DELETE /admin/catalogador/executions/:id — sólo borradores/canceladas/error (PRD §9.5). */
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
