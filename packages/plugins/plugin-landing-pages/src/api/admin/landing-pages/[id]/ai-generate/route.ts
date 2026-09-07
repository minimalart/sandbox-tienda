import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { LANDING_PAGE_MODULE } from '../../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../../modules/landing-page/service';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../../lib/foreign-modules';
import { generateLandingPuckData } from '../../../../../modules/landing-page/ai/generator';
import { sanitizePuckData } from '../../../../../modules/landing-page/ai/puck-schema';
import { LandingAiError, type PuckData } from '../../../../../modules/landing-page/ai/types';

const BodySchema = z.object({
  brief: z.string().min(1, 'El brief es obligatorio'),
  tone: z.string().optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  locale: z.string().optional(),
  campaign: z.string().optional(),
  components: z.array(z.string()).optional(),
  productContext: z.string().optional(),
  mode: z.enum(['replace', 'append', 'draft_only']).default('replace'),
});

/**
 * POST /admin/landing-pages/:id/ai-generate
 * Genera puck_data con AI (OpenRouter). modes: replace | append | draft_only.
 * Nunca cambia el `status` (no publica automáticamente).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
  }
  const body = parsed.data;
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
    const aiOverrides = { model: ai.text_model, maxRetries: ai.text_max_retries };

    const current = sanitizePuckData(landing.puck_data);
    const generated = await generateLandingPuckData(
      {
        brief: body.brief,
        tone: body.tone,
        goal: body.goal,
        audience: body.audience,
        locale: body.locale,
        campaign: body.campaign,
        components: body.components,
        productContext: body.productContext,
        currentPuckData: body.mode === 'append' ? current : null,
      },
      aiOverrides,
    );

    let next: PuckData = generated;
    if (body.mode === 'append') {
      next = sanitizePuckData({
        content: [...current.content, ...generated.content],
        root: current.root,
      });
    }

    let saved = false;
    if (body.mode !== 'draft_only') {
      await service.updateLandingPages({ id: landing.id, puck_data: next });
      saved = true;
    }

    const landing_page = saved
      ? await service.retrieveLandingPage(landing.id)
      : landing;

    return res.status(200).json({ landing_page, puck_data: next, saved });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación AI';
    return res.status(500).json({ message });
  }
}
