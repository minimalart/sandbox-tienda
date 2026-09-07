import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * Dispara la generación de órdenes seed (reales, con marca interna oculta)
 * server-side. Necesario porque la DB de prod tiene Trusted Sources y no se
 * puede correr el script desde fuera del droplet.
 *
 * Idempotente: no supera el objetivo `purchases`. Solo admin (auth de la ruta).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
