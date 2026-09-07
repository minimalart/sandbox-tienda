import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/abandoned-carts/:id/resend — dispara manualmente un paso de la
 * secuencia para un tracking. Body opcional `{ step: number }`; por defecto usa
 * el próximo paso elegible. Reutiliza el mismo workflow que el cron (idempotente
 * por paso+canal, así que no duplica si ese paso ya se envió).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
