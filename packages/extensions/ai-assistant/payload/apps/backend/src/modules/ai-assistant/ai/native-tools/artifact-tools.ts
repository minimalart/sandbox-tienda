import type { NativeToolContext, NativeToolDef } from './index';
import { NATIVE_TOOL } from './names';
import {
  ensureBannerMedia,
  ensureLandingContent,
  resolveProductTitles,
} from '../campaign-enrich';
import { loadLazyModule, sourceSpecifier } from '../../../../lib/lazy-module';

/** Sólo tipos: `typeof import()` no emite, así que los workflows siguen fuera del grafo. */
type CreateBannerWorkflow = typeof import('../../../../workflows/create-banner.js');
type CreateLandingPageWorkflow = typeof import('../../../../workflows/create-landing-page.js');

/**
 * Tools nativas de ARTEFACTOS para propuestas: crean un banner o una landing en
 * BORRADOR y los dejan COMPLETOS (imagen generada / contenido compuesto)
 * reutilizando el enriquecimiento determinístico de las campañas
 * (`campaign-enrich`). Existen porque el create crudo del MCP deja el banner
 * sin `media` y la landing sin `puck_data` — un borrador a medias que nadie
 * publica. NO están en NATIVE_ANALYSIS_TOOLS: durante el análisis solo se
 * proponen y corren recién al aprobar la propuesta (via executeProposal).
 */

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

export const ARTIFACT_TOOL_DEFS: NativeToolDef[] = [
  {
    name: NATIVE_TOOL.createBannerDraft,
    description:
      'Crea un BANNER en estado BORRADOR con su imagen generada por IA (16:9, subida al storage). Nunca publica: una persona lo revisa y publica desde el admin. Usala en propuestas en vez del create crudo de banners (que quedaría sin imagen).',
    parameters: {
      type: 'object',
      properties: {
        internal_name: { type: 'string', description: 'Nombre interno del banner (min 2 chars).' },
        title: { type: 'string', description: 'Título visible del banner.' },
        subtitle: { type: 'string', description: 'Bajada/subtítulo (opcional).' },
        cta_label: { type: 'string', description: 'Texto del botón (opcional).' },
        cta_url: { type: 'string', description: 'URL del botón, p. ej. /collections/ofertas (opcional).' },
        image_prompt: {
          type: 'string',
          description:
            'Descripción visual detallada de la imagen (preferentemente en inglés, sin texto dentro de la imagen). Si falta, se arma desde el título.',
        },
        alt: { type: 'string', description: 'Texto alternativo accesible de la imagen, en español.' },
        placement: { type: 'string', description: 'Ubicación (default "banner_1").' },
        start_at: { type: 'string', description: 'Inicio de vigencia ISO (opcional).' },
        end_at: { type: 'string', description: 'Fin de vigencia ISO (opcional).' },
      },
      required: ['internal_name', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: NATIVE_TOOL.createLandingDraft,
    description:
      'Crea una LANDING en estado BORRADOR con su contenido compuesto por IA (hero, beneficios, productos, CTA). Nunca publica: una persona la revisa y publica desde el admin. Usala en propuestas en vez del create crudo de landing_pages (que quedaría vacía).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título de la landing.' },
        slug: { type: 'string', description: 'Slug único en minúsculas-con-guiones (opcional; se genera del título).' },
        description: { type: 'string', description: 'Descripción corta (opcional).' },
        seo_title: { type: 'string' },
        seo_description: { type: 'string' },
        campaign_name: {
          type: 'string',
          description: 'Nombre de la campaña/temporada que motiva la landing (para el generador de contenido).',
        },
        brief: {
          type: 'string',
          description: 'Contexto extra para el contenido (objetivo, promo vigente, tono). Opcional.',
        },
        product_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Productos a destacar (sus títulos alimentan el contenido).',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
];

async function runCreateBannerDraft(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const internalName = str(args.internal_name);
  const title = str(args.title);
  if (!internalName) return 'Error: falta `internal_name`.';
  if (!title) return 'Error: falta `title`.';
  const subtitle = str(args.subtitle);
  const ctaLabel = str(args.cta_label);
  const ctaUrl = str(args.cta_url);

  // Mismo camino que el admin (valida, dedupe de handle, audit trail).
  const { createBannerWorkflow } = await loadLazyModule<CreateBannerWorkflow>(
    'el workflow de creación de banner',
    () => require('../../../../workflows/create-banner'),
    () => import(sourceSpecifier('../../../../workflows/create-banner')),
  );
  const { result: banner } = await createBannerWorkflow(ctx.container as any).run({
    input: {
      internal_name: internalName,
      placement: str(args.placement) ?? 'banner_1',
      type: 'hero',
      status: 'draft',
      content: { title, ...(subtitle ? { subtitle } : {}) },
      cta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : null,
      start_at: str(args.start_at) ?? null,
      end_at: str(args.end_at) ?? null,
      user_id: ctx.createdBy ?? undefined,
    } as any,
  });
  const id = (banner as { id?: string })?.id;
  if (!id) return 'Error: el banner no se pudo crear.';

  const prompt =
    str(args.image_prompt) ??
    `Wide 16:9 hero banner background for an online food store campaign titled "${title}". Appetizing, warm lighting, no text.`;
  const enrich = await ensureBannerMedia(ctx.container, id, {
    prompt,
    alt: str(args.alt) ?? title,
  });
  const imgNote =
    enrich === 'failed'
      ? 'la imagen NO se pudo generar (cargala a mano desde el admin)'
      : 'con imagen generada';
  return `OK: banner creado en BORRADOR (${imgNote}). banner_id=${id}. Se publica a mano desde el admin: Site Manager → Banners.`;
}

async function runCreateLandingDraft(
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string> {
  const title = str(args.title);
  if (!title) return 'Error: falta `title`.';
  const seoTitle = str(args.seo_title);
  const seoDescription = str(args.seo_description);

  // Mismo camino que el admin (slug único, defaults, compensación).
  const { createLandingPageWorkflow } = await loadLazyModule<CreateLandingPageWorkflow>(
    'el workflow de creación de landing',
    () => require('../../../../workflows/create-landing-page'),
    () => import(sourceSpecifier('../../../../workflows/create-landing-page')),
  );
  const { result: landing } = await createLandingPageWorkflow(ctx.container as any).run({
    input: {
      title,
      slug: str(args.slug),
      status: 'draft',
      description: str(args.description) ?? null,
      seo:
        seoTitle || seoDescription
          ? { ...(seoTitle ? { title: seoTitle } : {}), ...(seoDescription ? { description: seoDescription } : {}) }
          : null,
      created_by: ctx.createdBy ?? null,
    } as any,
  });
  const id = (landing as { id?: string })?.id;
  const slug = (landing as { slug?: string })?.slug;
  if (!id) return 'Error: la landing no se pudo crear.';

  const productTitles = await resolveProductTitles(ctx.container, strArr(args.product_ids));
  const brief = str(args.brief);
  const enrich = await ensureLandingContent(ctx.container, id, {
    campaignName: str(args.campaign_name) ?? title,
    objective: brief ? [brief] : undefined,
    productTitles,
  });
  const contentNote =
    enrich === 'failed'
      ? 'el contenido NO se pudo componer (editala a mano desde el admin)'
      : 'con contenido compuesto';
  return `OK: landing creada en BORRADOR (${contentNote}). landing_id=${id} | slug=${slug}. Se publica a mano desde el admin: Site Manager → Landings.`;
}

/** Ejecuta una tool de artefactos por nombre; `undefined` si no es de este set. */
export async function runArtifactNativeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: NativeToolContext,
): Promise<string | undefined> {
  if (name === NATIVE_TOOL.createBannerDraft) return runCreateBannerDraft(args, ctx);
  if (name === NATIVE_TOOL.createLandingDraft) return runCreateLandingDraft(args, ctx);
  return undefined;
}
