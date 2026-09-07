import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { LANDING_PAGE_MODULE } from '../../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../../modules/landing-page/service';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../../lib/foreign-modules';
import { generateLandingSeo } from '../../../../../modules/landing-page/ai/generator';
import { sanitizePuckData } from '../../../../../modules/landing-page/ai/puck-schema';
import { LandingAiError } from '../../../../../modules/landing-page/ai/types';

const BodySchema = z.object({
  locale: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

/**
 * POST /admin/landing-pages/:id/ai-seo
 * Genera title/description/image/noindex y los guarda en `seo`.
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
    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();
    const seo = await generateLandingSeo(
      {
        title: landing.title,
        locale: parsed.data.locale,
        keywords: parsed.data.keywords,
        currentPuckData: sanitizePuckData(landing.puck_data),
      },
      { model: ai.text_model },
    );
    await service.updateLandingPages({ id: landing.id, seo });
    const landing_page = await service.retrieveLandingPage(landing.id);
    return res.status(200).json({ landing_page, seo, saved: true });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación de SEO';
    return res.status(500).json({ message });
  }
}
