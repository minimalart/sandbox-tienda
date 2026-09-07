import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
/**
 * Beneficios de pago aplicables y vigentes, scopeados por sales channel.
 * Con `product_id` (+ collection/category/brand) devuelve solo los que aplican
 * al producto; sin él, todos los activos del canal (para el checkout).
 * Nunca modifica el precio: es informativo (PRD §14).
 */
export declare function GET(req: MedusaRequest, res: MedusaResponse): Promise<void>;
