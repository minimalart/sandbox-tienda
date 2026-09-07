import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * Catálogo público de medios de pago sincronizados (con logos). Alimenta el
 * "Ver todos los medios de pago" de la ficha de producto. Incluye TODOS los
 * medios activos, tengan o no cuotas sin interés.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
