import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * GET /admin/abandoned-carts — listado paginado + métricas agregadas.
 * Query: `limit`, `offset`, `status` (opcional), `sales_channel_id` (opcional).
 *
 * `sales_channel_id` acota el listado Y las métricas: con varios canales, un
 * agregado global no dice nada sobre el rendimiento de cada tienda.
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
