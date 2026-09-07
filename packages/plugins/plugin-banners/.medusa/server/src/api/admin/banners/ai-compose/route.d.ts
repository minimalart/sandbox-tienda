import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/banners/ai-compose
 * Genera de una sola vez el "slide" completo de un banner: copy (title/subtitle/
 * body + CTA) e imagen. Cuando se eligen productos, sus datos alimentan el copy
 * y sus fotos se mandan como REFERENCIA al modelo de imagen (nano banana) para
 * que aparezcan en el banner sin deformarse.
 *
 * Es resiliente: copy e imagen se generan en paralelo con Promise.allSettled, así
 * que si una parte falla la otra igual vuelve (con un warning). Solo error duro
 * si fallan ambas. Stateless: el form aplica el resultado y persiste al guardar.
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
