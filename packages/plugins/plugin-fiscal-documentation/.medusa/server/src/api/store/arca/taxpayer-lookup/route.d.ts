import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { PostArcaTaxpayerLookupType } from './validators';
/**
 * Diagnóstico liviano: dice si la INSTANCIA tiene la identidad fiscal cargada.
 *
 * Sigue siendo de instancia y no de tienda a propósito. Es un endpoint público (sólo
 * publishable key) que el storefront usa para decidir si muestra el autocompletado
 * de Factura A; responder por tienda le daría a cualquiera con una publishable key
 * un mapa de qué tiendas del backend tienen certificado propio. El POST sí resuelve
 * la tienda, que es donde importa.
 */
export declare function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void>;
export declare function POST(req: MedusaRequest<PostArcaTaxpayerLookupType>, res: MedusaResponse): Promise<void>;
