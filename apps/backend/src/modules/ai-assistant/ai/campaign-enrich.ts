import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService, MedusaContainer } from '@medusajs/framework/types';
import { generateImage } from '../../landing-page/ai/image-client';
import { optimizeToWebp } from '../../landing-page/ai/image-optimize';
import { generateLandingPuckData } from '../../landing-page/ai/generator';
import { sanitizePuckData } from '../../landing-page/ai/puck-schema';
import { BANNER_MODULE } from '../../banner';
import { LANDING_PAGE_MODULE } from '../../landing-page';
import { STORE_CONFIG_MODULE } from '../../store-config';

/**
 * Enriquecimiento DETERMINÍSTICO de los artefactos del workflow "Campaña
 * comercial". El run del 2026-07-23 mostró que los subagentes (reasoning bajo)
 * cierran su paso "en verde" pero dejan el artefacto a medias: banner sin
 * `media`, landing con `puck_data` vacío. En vez de confiar en el prompt, el
 * motor llama estas funciones DESPUÉS del paso y completa lo que falte con las
 * mismas piezas que usan las rutas admin (generateImage + generateLandingPuckData).
 * Todo es best-effort: devuelven un status para el checklist y nunca tiran.
 */

type AiConfigLike = {
  image_model?: string;
  image_quality?: number;
  image_max_kb?: number;
  text_model?: string;
  text_max_retries?: number;
};

async function getAiConfig(container: MedusaContainer): Promise<AiConfigLike> {
  try {
    const storeConfig: any = container.resolve(STORE_CONFIG_MODULE);
    return (await storeConfig.getAiConfig()) ?? {};
  } catch {
    return {};
  }
}

function parseMaybeJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return null;
}

export type EnrichResult = 'already_complete' | 'enriched' | 'failed';

/**
 * Si el banner quedó sin `media`, genera una imagen 16:9 para la campaña, la
 * sube al storage y la setea. Si el subagente ya la adjuntó, no hace nada.
 */
export async function ensureBannerMedia(
  container: MedusaContainer,
  bannerId: string,
  opts: { prompt: string; alt: string },
): Promise<EnrichResult> {
  try {
    const svc: any = container.resolve(BANNER_MODULE);
    const banner = await svc.retrieveBanner(bannerId);
    const media = parseMaybeJson<{ url?: string }>(banner?.media);
    if (media?.url) return 'already_complete';

    const ai = await getAiConfig(container);
    const generated = await generateImage({
      prompt: opts.prompt,
      model: ai.image_model,
      aspectRatio: '16:9',
    });
    const webp = await optimizeToWebp(generated.bytes, 'hero', {
      quality: typeof ai.image_quality === 'number' ? ai.image_quality : 72,
      maxKb: typeof ai.image_max_kb === 'number' ? ai.image_max_kb : 500,
    });
    const fileModule = container.resolve<IFileModuleService>(Modules.FILE);
    const [file] = await fileModule.createFiles([
      {
        filename: `banner-ai-${Date.now()}.webp`,
        mimeType: 'image/webp',
        content: webp.base64,
        access: 'public',
      },
    ]);
    if (!file?.url) return 'failed';

    await svc.updateBanners({
      id: bannerId,
      media: { url: file.url, alt: opts.alt, type: 'image' },
    });
    return 'enriched';
  } catch {
    return 'failed';
  }
}

/**
 * Si la landing quedó sin bloques (`puck_data.content` vacío), compone el
 * contenido con el generador del Site Manager (el mismo de la ruta
 * `POST /admin/landing-pages/:id/ai-generate`) y lo guarda. Nunca publica.
 */
export async function ensureLandingContent(
  container: MedusaContainer,
  landingId: string,
  brief: {
    campaignName: string;
    tone?: string[];
    objective?: string[];
    startDate?: string;
    endDate?: string;
    promotion?: { type?: string; value?: number | null } | null;
    productTitles?: string[];
  },
): Promise<EnrichResult> {
  try {
    const svc: any = container.resolve(LANDING_PAGE_MODULE);
    const landing = await svc.retrieveLandingPage(landingId);
    const current = sanitizePuckData(landing?.puck_data);
    if (current.content.length > 0) return 'already_complete';

    const promo =
      brief.promotion?.type && brief.promotion.type !== 'highlight_only'
        ? `Promoción: ${brief.promotion.type}${brief.promotion.value ? ` ${brief.promotion.value}${brief.promotion.type === 'percentage' ? '%' : ''}` : ''} (se activa al publicar la campaña).`
        : '';
    const ai = await getAiConfig(container);
    const generated = await generateLandingPuckData(
      {
        brief:
          `Landing de la campaña comercial "${brief.campaignName}"` +
          (brief.startDate && brief.endDate ? `, vigente del ${brief.startDate} al ${brief.endDate}` : '') +
          `. Objetivos: ${(brief.objective ?? []).join(', ') || 'ventas'}. ${promo} ` +
          'Armá una landing persuasiva y concreta: hero con el nombre de la campaña, beneficios, productos destacados y cierre con llamado a la acción. En español argentino (voseo).',
        tone: (brief.tone ?? []).join(', ') || undefined,
        goal: (brief.objective ?? []).join(', ') || undefined,
        campaign: brief.campaignName,
        productContext: brief.productTitles?.length
          ? `Productos de la campaña: ${brief.productTitles.join(', ')}`
          : undefined,
        currentPuckData: null,
      },
      { model: ai.text_model, maxRetries: ai.text_max_retries },
    );

    await svc.updateLandingPages({ id: landingId, puck_data: generated });
    return 'enriched';
  } catch {
    return 'failed';
  }
}

/** Títulos de los productos de la campaña (para el contexto de la landing). Best-effort. */
export async function resolveProductTitles(
  container: MedusaContainer,
  productIds: string[],
): Promise<string[]> {
  if (!productIds.length) return [];
  try {
    const productModule: any = container.resolve(Modules.PRODUCT);
    const rows = await productModule.listProducts(
      { id: productIds },
      { select: ['id', 'title'], take: productIds.length },
    );
    return (rows ?? [])
      .map((p: { title?: string | null }) => (typeof p.title === 'string' ? p.title.trim() : ''))
      .filter(Boolean);
  } catch {
    return [];
  }
}
