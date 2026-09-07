import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { LANDING_PAGE_MODULE } from '../../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../../modules/landing-page/service';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../../lib/foreign-modules';
import { translateLanding } from '../../../../../modules/landing-page/ai/generator';
import { sanitizePuckData } from '../../../../../modules/landing-page/ai/puck-schema';
import { LandingAiError } from '../../../../../modules/landing-page/ai/types';

const BodySchema = z.object({
  target_locale: z.string().min(2, 'target_locale es obligatorio'),
});

/**
 * POST /admin/landing-pages/:id/ai-translate
 * Traduce los textos al locale destino conservando estructura/links/handles.
 * Guarda el resultado sin tocar el `status`.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
  }
  const service: LandingPageModuleService = req.scope.resolve(LANDING_PAGE_MODULE);

  let landing: Record<string, any>;
  try {
    landing = (await service.retrieveLandingPage(req.params.id as string)) as Record<string, any>;
  } catch {
    return res.status(404).json({ message: 'Landing page no encontrada' });
  }

  try {
    const current = sanitizePuckData(landing.puck_data);
    if (current.content.length === 0) {
      return res.status(400).json({ message: 'La landing no tiene contenido para traducir.' });
    }
    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const next = await translateLanding(
      {
        targetLocale: parsed.data.target_locale,
        currentPuckData: current,
      },
      { model: ai.text_model, maxRetries: ai.text_max_retries },
    );
    await service.updateLandingPages({ id: landing.id, puck_data: next });
    const landing_page = await service.retrieveLandingPage(landing.id);
    return res.status(200).json({ landing_page, puck_data: next, saved: true });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la traducción';
    return res.status(500).json({ message });
  }
}
