import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../modules/store-config/service';

/**
 * La tienda cuya configuración se está viendo o editando.
 *
 * `null` = la fila GLOBAL de la instancia, que es el fallback de toda tienda que no
 * defina el suyo. Es lo que pasa en una instalación mono-tienda y en cualquier
 * pantalla que todavía no mande la tienda activa: el comportamiento por defecto es
 * exactamente el de antes.
 */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * POST /admin/store-config/ai-config body validator.
 *
 * Todos los campos son opcionales (upsert parcial). Los clamps/normalización
 * finales los aplica el service (`upsertAiConfig` → `mergeAiConfig`); acá sólo
 * validamos forma básica para devolver errores claros.
 */
const UpdateAiConfigSchema = z.object({
  text_model: z.string().trim().min(1).max(120).optional(),
  text_max_retries: z.coerce.number().int().min(0).max(5).optional(),
  chat_model: z.string().trim().min(1).max(120).optional(),
  chat_reasoning_effort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  chat_max_tokens: z.coerce.number().int().min(500).max(32000).optional(),
  chat_validation_enabled: z.coerce.boolean().optional(),
  image_model: z.string().trim().min(1).max(120).optional(),
  image_quality: z.coerce.number().int().min(40).max(90).optional(),
  image_max_kb: z.coerce.number().int().min(50).max(1000).optional(),
  memory_enabled: z.coerce.boolean().optional(),
  memory_autocapture_enabled: z.coerce.boolean().optional(),
  memory_autocapture_requires_approval: z.coerce.boolean().optional(),
  memory_retrieval_topk: z.coerce.number().int().min(1).max(20).optional(),
  memory_min_similarity: z.coerce.number().min(0).max(1).optional(),
  embeddings_model: z.string().trim().min(1).max(120).optional(),
});

/**
 * GET /admin/store-config/ai-config — configuración de IA actual, siempre
 * completa (mergeada sobre defaults sembrados de env).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai_config = await service.getAiConfig(await siteOf(req));
    return res.status(200).json({ ai_config });
  } catch (error) {
    console.error('[Admin StoreConfig] Error reading ai config:', error);
    return res.status(500).json({ message: 'Error reading ai config' });
  }
}

/**
 * POST /admin/store-config/ai-config — upsert (parcial) de la configuración de IA.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = UpdateAiConfigSchema.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai_config = await service.upsertAiConfig(body, await siteOf(req));
    return res.status(200).json({ ai_config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating ai config';
    console.error('[Admin StoreConfig] Error updating ai config:', message);
    return res.status(400).json({ message });
  }
}
