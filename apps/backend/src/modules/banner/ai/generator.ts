import { z } from 'zod';
import { callOpenRouter, getAiConfig } from '../../landing-page/ai/client';
import { LandingAiError } from '../../landing-page/ai/types';
import { buildBannerCopyMessages, type GenerateBannerCopyInput } from './prompts';

/** Extrae el primer objeto JSON de una respuesta (tolerante a fences/ruido). */
function extractJson(raw: string): unknown | null {
  if (!raw) return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* sigue */
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(s.slice(first, last + 1));
    } catch {
      /* noop */
    }
  }
  return null;
}

const BannerCopySchema = z.object({
  content: z
    .object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
  cta: z
    .object({
      label: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
});

export type GeneratedBannerCopy = {
  content: { title: string; subtitle: string; body: string };
  cta: { label: string; url: string };
};

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();
/** Solo rutas relativas o http(s) seguros; bloquea esquemas peligrosos. */
const safeHref = (u: string) => (/^(javascript|data|vbscript|file):/i.test(u.trim()) ? '' : u.trim());

export type BannerAiTextConfig = { model?: string; maxRetries?: number };

/**
 * Genera el copy de un banner (title/subtitle/body + CTA) con OpenRouter.
 * Reutiliza el cliente del módulo landing-page. Reintenta hasta `maxRetries`.
 */
export async function generateBannerCopy(
  input: GenerateBannerCopyInput,
  aiConfig?: BannerAiTextConfig,
): Promise<GeneratedBannerCopy> {
  if (!input.brief?.trim()) {
    throw new LandingAiError('El brief es obligatorio para generar el banner.', 400);
  }
  const maxRetries = aiConfig?.maxRetries ?? getAiConfig().maxRetries;
  const messages = buildBannerCopyMessages(input);
  let lastError = 'respuesta no parseable';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const msgs =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: 'user' as const,
              content: `El intento anterior falló (${lastError}). Devolvé SOLO el JSON con la forma pedida, sin texto extra.`,
            },
          ];

    const raw = await callOpenRouter(msgs, { model: aiConfig?.model });
    const json = extractJson(raw);
    if (!json) {
      lastError = 'no se encontró JSON en la respuesta';
      continue;
    }
    const parsed = BannerCopySchema.safeParse(json);
    if (parsed.success) {
      const d = parsed.data;
      return {
        content: {
          title: stripTags(d.content?.title ?? '').slice(0, 120),
          subtitle: stripTags(d.content?.subtitle ?? '').slice(0, 180),
          body: stripTags(d.content?.body ?? '').slice(0, 300),
        },
        cta: {
          label: stripTags(d.cta?.label ?? '').slice(0, 40),
          url: safeHref(d.cta?.url ?? '').slice(0, 2000),
        },
      };
    }
    lastError = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
      .slice(0, 300);
  }

  throw new LandingAiError(
    `La IA no devolvió un copy válido tras ${maxRetries + 1} intentos. ${lastError}`,
    422,
  );
}
