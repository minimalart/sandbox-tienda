import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { z } from 'zod';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../lib/foreign-modules';
import { generateImage } from '../../../../lib/landing-ai/image-client';
import { optimizeToWebp } from '../../../../lib/landing-ai/image-optimize';
import { buildBannerImagePrompt } from '../../../../modules/banner/ai/prompts';
import { LandingAiError } from '../../../../lib/landing-ai/types';

const BodySchema = z.object({
  brief: z.string().min(1, 'El brief es obligatorio'),
  title: z.string().optional(),
  styleHint: z.string().max(500).optional(),
  aspectRatio: z.enum(['16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
});

/**
 * POST /admin/banners/ai-image
 * Genera UNA imagen para un banner (nano banana vía OpenRouter), la optimiza a
 * WebP y la sube al File module (S3/DO Spaces). Stateless: devuelve la URL para
 * que el form la use en `media_url`. Reutiliza el pipeline de imágenes de
 * landing-page (generateImage + optimizeToWebp).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
  }
  const body = parsed.data;
  try {
    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();

    const prompt = buildBannerImagePrompt({
      brief: body.brief,
      title: body.title,
      styleHint: body.styleHint,
    });

    const generated = await generateImage({
      prompt,
      model: ai.image_model,
      aspectRatio: body.aspectRatio ?? '16:9',
    });

    // 'hero' = 1600px de ancho, ideal para un banner horizontal.
    const webp = await optimizeToWebp(generated.bytes, 'hero', {
      quality: ai.image_quality,
      maxKb: ai.image_max_kb,
    });

    const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
    const [file] = await fileModule.createFiles([
      {
        filename: `banner-ai-${Date.now()}.webp`,
        mimeType: 'image/webp',
        content: webp.base64,
        // S3/DO Spaces exige ACL público explícito o el <img> recibe 403.
        access: 'public',
      },
    ]);
    if (!file?.url) {
      return res.status(500).json({ message: 'No se pudo guardar la imagen generada.' });
    }

    return res.status(200).json({ image_url: file.url, bytes: webp.bytes });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación de imagen';
    return res.status(500).json({ message });
  }
}
