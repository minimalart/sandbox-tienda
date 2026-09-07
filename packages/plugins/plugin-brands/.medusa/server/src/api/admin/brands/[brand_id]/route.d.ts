import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
export declare const UpdateBrandSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    handle: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    sales_channel_ids: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
/**
 * Las tres rutas de detalle pasan por `assertRowInSite`.
 *
 * Filtrar sólo el listado esconde la marca de otra tienda pero deja editarla y
 * borrarla si conocés el id — que es una escritura cruzada real, no cosmética. Por
 * eso una ruta cuenta como migrada sólo si sus mutaciones también validan.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<UpdateBrandInput>, res: MedusaResponse): Promise<void>;
export declare function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void>;
export {};
