import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
/**
 * POST /admin/landing-pages/:id/ai-generate
 * Genera puck_data con AI (OpenRouter). modes: replace | append | draft_only.
 * Nunca cambia el `status` (no publica automáticamente).
 */
export declare function POST(req: MedusaRequest, res: MedusaResponse): Promise<MedusaResponse>;
