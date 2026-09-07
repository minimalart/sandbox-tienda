import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { Modules } from '@medusajs/framework/utils';
import type { IFileModuleService } from '@medusajs/framework/types';
import { z } from 'zod';
import { LANDING_PAGE_MODULE } from '../../../../../modules/landing-page';
import type LandingPageModuleService from '../../../../../modules/landing-page/service';
import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../../../../lib/foreign-modules';
import { sanitizePuckData } from '../../../../../modules/landing-page/ai/puck-schema';
import { buildImagePrompt } from '../../../../../modules/landing-page/ai/prompts';
import {
  generateImage,
  type AspectRatio,
} from '../../../../../modules/landing-page/ai/image-client';
import {
  optimizeToWebp,
  type SlotKind,
} from '../../../../../modules/landing-page/ai/image-optimize';
import { LandingAiError } from '../../../../../modules/landing-page/ai/types';

const BodySchema = z.object({
  blockId: z.string().min(1, 'blockId es obligatorio'),
  styleHint: z.string().max(500).optional(),
  aspectRatio: z.enum(['16:9', '1:1', '4:3', '3:4', '9:16']).optional(),
  overwrite: z.boolean().default(false),
});

type AnyBlock = { type?: string; props?: Record<string, any> };

/** Campo de imagen y kind según el tipo de bloque (o null si no aplica). */
const slotForBlock = (
  block: AnyBlock,
): { field: 'image' | 'src'; kind: SlotKind } | null => {
  if (block.type === 'Hero') return { field: 'image', kind: 'hero' };
  if (block.type === 'ImageBlock') return { field: 'src', kind: 'imageBlock' };
  return null;
};

/** Busca un bloque por su props.id en content y en todas las zones. */
const findBlock = (puck: any, blockId: string): AnyBlock | null => {
  const lists: AnyBlock[][] = [puck.content ?? []];
  if (puck.zones && typeof puck.zones === 'object') {
    for (const arr of Object.values(puck.zones)) {
      if (Array.isArray(arr)) lists.push(arr as AnyBlock[]);
    }
  }
  for (const list of lists) {
    for (const block of list) {
      if (block?.props?.id === blockId) return block;
    }
  }
  return null;
};

const DEFAULT_ASPECT: Record<SlotKind, AspectRatio> = {
  hero: '16:9',
  imageBlock: '4:3',
};

/**
 * POST /admin/landing-pages/:id/ai-image
 * Genera UNA imagen (nano banana vía OpenRouter) para un slot del puck_data,
 * la optimiza a WebP, la sube al File module y reemplaza la URL en el bloque.
 * Per-imagen a propósito (la UI itera los slots vacíos con progreso).
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
    const current = sanitizePuckData(landing.puck_data);
    const block = findBlock(current, body.blockId);
    if (!block) {
      return res.status(400).json({ message: 'El bloque indicado no existe en la landing.' });
    }
    const slot = slotForBlock(block);
    if (!slot) {
      return res.status(400).json({ message: 'El bloque indicado no admite imagen.' });
    }

    const props = block.props ?? (block.props = {});
    const existing = typeof props[slot.field] === 'string' ? (props[slot.field] as string) : '';

    // Idempotencia: no pisar una imagen ya seteada salvo overwrite explícito.
    if (existing.trim() && !body.overwrite) {
      return res.status(200).json({
        landing_page: landing,
        puck_data: current,
        block_id: body.blockId,
        image_url: existing,
        bytes: 0,
        skipped: true,
        saved: false,
      });
    }

    const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
    const ai = await storeConfig.getAiConfig();

    const prompt = buildImagePrompt({
      kind: slot.kind,
      landingTitle: landing.title ?? '',
      slotTitle: typeof props.title === 'string' ? props.title : undefined,
      slotSubtitle: typeof props.subtitle === 'string' ? props.subtitle : undefined,
      alt: typeof props.alt === 'string' ? props.alt : undefined,
      caption: typeof props.caption === 'string' ? props.caption : undefined,
      styleHint: body.styleHint,
    });

    const generated = await generateImage({
      prompt,
      model: ai.image_model,
      aspectRatio: body.aspectRatio ?? DEFAULT_ASPECT[slot.kind],
    });

    const webp = await optimizeToWebp(generated.bytes, slot.kind, {
      quality: ai.image_quality,
      maxKb: ai.image_max_kb,
    });

    const fileModule = req.scope.resolve<IFileModuleService>(Modules.FILE);
    const [file] = await fileModule.createFiles([
      {
        filename: `landing-${landing.id}-${body.blockId}-${Date.now()}.webp`,
        mimeType: 'image/webp',
        content: webp.base64,
        // S3/DO Spaces exige ACL público explícito, si no el <img> recibe 403.
        access: 'public',
      },
    ]);
    if (!file?.url) {
      return res.status(500).json({ message: 'No se pudo guardar la imagen generada.' });
    }

    // Escribimos la URL https en el slot y re-sanitizamos (la URL https
    // sobrevive sanitizeHref; un data: se bloquearía, por eso subimos primero).
    props[slot.field] = file.url;
    const next = sanitizePuckData(current);
    await service.updateLandingPages({ id: landing.id, puck_data: next });
    const landing_page = await service.retrieveLandingPage(landing.id);

    return res.status(200).json({
      landing_page,
      puck_data: next,
      block_id: body.blockId,
      image_url: file.url,
      bytes: webp.bytes,
      skipped: false,
      saved: true,
    });
  } catch (error) {
    if (error instanceof LandingAiError) {
      return res.status(error.status).json({ message: error.message });
    }
    const message = error instanceof Error ? error.message : 'Falló la generación de imagen';
    return res.status(500).json({ message });
  }
}
