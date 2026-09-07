import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../lib/foreign-modules';
import { generateBannerCopy } from '../../../../modules/banner/ai/generator';
import { LandingAiError } from '../../../../lib/landing-ai/types';

const BodySchema = z.object({
  brief: z.string().min(1, 'El brief es obligatorio'),
  tone: z.string().optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  locale: z.string().optional(),
  placement: z.string().optional(),
});

/**
 * POST /admin/banners/ai-generate
 * Genera el copy de un banner (title/subtitle/body + CTA) con IA. Stateless:
 * sirve para crear y editar (el banner puede no existir todavía). Devuelve el
 * copy para que el form lo aplique; no persiste nada.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
  }
  try {
    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const result = await generateBannerCopy(parsed.data, {
      model: ai.text_model,
      maxRetries: ai.text_max_retries,
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación con IA';
    return res.status(500).json({ message });
  }
}
