import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * Agrega imágenes de la Biblioteca a un producto: mergea con las actuales,
 * dedup por URL (no agrega las que ya tiene), mantiene las existentes.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<void>;
