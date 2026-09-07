import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { z } from 'zod';
/**
 * Body de `POST /admin/catalogador/config`.
 *
 * Deliberadamente un `record` con `superRefine` y NO un `z.object({...})`: un
 * schema de objeto DESCARTA las claves que no modela, así que uno incompleto
 * borraría secciones enteras de la config en cada guardado (la UI manda el objeto
 * completo). Esta forma valida lo que importa sin poder perder nada.
 */
export declare const CatalogadorConfigSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
/** GET /admin/catalogador/config — config efectiva (sin secretos). */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
/**
 * POST /admin/catalogador/config — persiste config (merge parcial). Los secretos
 * (API keys de barcode/scraping) NO se aceptan acá: viven en env (PRD §22.4).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
