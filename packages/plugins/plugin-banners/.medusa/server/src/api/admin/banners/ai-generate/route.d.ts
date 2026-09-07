import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/ai-generate
 * Genera el copy de un banner (title/subtitle/body + CTA) con IA. Stateless:
 * sirve para crear y editar (el banner puede no existir todavía). Devuelve el
 * copy para que el form lo aplique; no persiste nada.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
