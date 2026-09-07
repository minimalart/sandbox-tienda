import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /store/pdf-catalog/active — el catálogo PDF activo para el canal actual.
 *
 * Query: `sales_channel_id` (obligatorio para resolver el activo), `region_id`
 * (para el precio de los hotspots de producto).
 * - Si el toggle global está apagado → { catalog: null }.
 * - Si el canal no tiene catálogo activo o el activo no está publicado → { catalog: null }.
 * - Enriquece hotspots de producto con precio (según región) y stock.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
