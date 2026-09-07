import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * GET /store/shop-by-look — looks activos para el canal/región actuales.
 *
 * Query: `sales_channel_id`, `region_id` (los manda el storefront).
 * - Si el toggle global está apagado → { looks: [] }.
 * - Filtra por segmentación (canal/región), enriquece productos con precio (según
 *   región) y stock, oculta productos sin stock / inexistentes, y descarta looks
 *   que se quedan sin productos válidos.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
