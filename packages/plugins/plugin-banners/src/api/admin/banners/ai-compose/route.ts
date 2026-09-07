import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { z } from 'zod';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../lib/foreign-modules';
import { generateImage } from '../../../../lib/landing-ai/image-client';
import { optimizeToWebp } from '../../../../lib/landing-ai/image-optimize';
import { generateBannerCopy } from '../../../../modules/banner/ai/generator';
import { buildBannerImagePrompt } from '../../../../modules/banner/ai/prompts';
import { toReferenceDataUrls } from '../../../../modules/banner/ai/products';
import { LandingAiError } from '../../../../lib/landing-ai/types';

const BodySchema = z.object({
  brief: z.string().min(1, 'El brief es obligatorio'),
  tone: z.string().optional(),
  goal: z.string().optional(),
  audience: z.string().optional(),
  locale: z.string().optional(),
  placement: z.string().optional(),
  styleHint: z.string().max(500).optional(),
  aspectRatio: z.enum(['21:9', '16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
  productIds: z.array(z.string()).max(6).optional(),
});

type ProductLite = {
  id: string;
  title?: string;
  description?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  images?: Array<{ url?: string | null }> | null;
};

const errMessage = (reason: unknown) =>
  reason instanceof Error ? reason.message : String(reason);

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
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Body inválido' });
  }
  const body = parsed.data;
  const productIds = body.productIds ?? [];

  try {
    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();

    // 1) Productos → contexto de copy + fotos de referencia (respetando el orden
    //    de selección para elegir un CTA determinístico).
    let products: ProductLite[] = [];
    if (productIds.length > 0) {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
      const { data } = (await query.graph({
        entity: 'product',
        fields: ['id', 'title', 'description', 'handle', 'thumbnail', 'images.url'],
        filters: { id: productIds },
      })) as { data: ProductLite[] };
      const byId = new Map(data.map((p) => [p.id, p]));
      products = productIds.map((id) => byId.get(id)).filter((p): p is ProductLite => !!p);
    }

    const copyProducts = products.map((p) => ({
      title: p.title ?? '',
      description: p.description ?? undefined,
    }));
    const productTitles = products.map((p) => p.title ?? '').filter(Boolean);
    const productHandles = products.map((p) => p.handle ?? '').filter(Boolean);
    const referenceUrls = products.map((p) => p.thumbnail || p.images?.[0]?.url || null);
    const referenceImages = await toReferenceDataUrls(referenceUrls, 4);

    // 2) Copy + imagen en paralelo (tolerante a fallos de una de las dos).
    const copyPromise = generateBannerCopy(
      {
        brief: body.brief,
        tone: body.tone,
        goal: body.goal,
        audience: body.audience,
        locale: body.locale,
        placement: body.placement,
        products: copyProducts,
      },
      { model: ai.text_model, maxRetries: ai.text_max_retries },
    );

    const imagePromise = (async () => {
      const prompt = buildBannerImagePrompt({
        brief: body.brief,
        styleHint: body.styleHint,
        productTitles,
        withProductRefs: referenceImages.length > 0,
      });
      const generated = await generateImage({
        prompt,
        model: ai.image_model,
        aspectRatio: body.aspectRatio ?? '16:9',
        referenceImages,
      });
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
        throw new LandingAiError('No se pudo guardar la imagen generada.', 500);
      }
      return { image_url: file.url, bytes: webp.bytes };
    })();

    const [copyR, imageR] = await Promise.allSettled([copyPromise, imagePromise]);

    // Si fallan las dos, es un error duro (devolvemos el status de la de copy).
    if (copyR.status === 'rejected' && imageR.status === 'rejected') {
      const primary = copyR.reason instanceof LandingAiError ? copyR.reason : imageR.reason;
      const status = primary instanceof LandingAiError ? primary.status : 500;
      return res.status(status).json({
        message: `${errMessage(copyR.reason)} | ${errMessage(imageR.reason)}`,
      });
    }

    const warnings: string[] = [];
    let content = { title: '', subtitle: '', body: '' };
    let cta = { label: '', url: '' };
    if (copyR.status === 'fulfilled') {
      content = copyR.value.content;
      cta = copyR.value.cta;
    } else {
      warnings.push(`copy: ${errMessage(copyR.reason)}`);
    }

    let image_url = '';
    let bytes = 0;
    if (imageR.status === 'fulfilled') {
      image_url = imageR.value.image_url;
      bytes = imageR.value.bytes;
    } else {
      warnings.push(`imagen: ${errMessage(imageR.reason)}`);
    }

    // Si el copy no propuso CTA y hay un producto elegido, apuntamos al primero.
    if (!cta.url && productHandles[0]) {
      cta = { label: cta.label || 'Ver producto', url: `/products/${productHandles[0]}` };
    }

    return res.status(200).json({ content, cta, image_url, bytes, product_ids: productIds, warnings });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación con IA';
    return res.status(500).json({ message });
  }
}
