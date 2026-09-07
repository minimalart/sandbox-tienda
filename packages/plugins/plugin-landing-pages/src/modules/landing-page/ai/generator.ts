import { z } from 'zod';
import { callOpenRouter, getAiConfig, type ChatMessage } from './client';
import {
  buildGenerateMessages,
  buildImproveCopyMessages,
  buildSeoMessages,
  buildTranslateMessages,
} from './prompts';
import { PuckDataSchema, sanitizePuckData, type PuckData } from './puck-schema';
import {
  LandingAiError,
  type GenerateLandingInput,
  type ImproveCopyInput,
  type LandingSeo,
  type SeoInput,
  type TranslateInput,
} from './types';

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

/**
 * Config de IA para generación de texto, resuelta desde store-config (con
 * fallback a los defaults de env). Se pasa desde la route.
 */
export type AiTextConfig = { model?: string; maxRetries?: number };

/**
 * Llama al modelo, extrae JSON, lo valida contra PuckDataSchema y lo sanitiza.
 * Reintenta hasta `maxRetries` pidiendo corrección. Lanza LandingAiError si
 * nunca obtiene un puck_data utilizable.
 */
async function runPuckGeneration(
  messages: ChatMessage[],
  aiConfig?: AiTextConfig,
): Promise<PuckData> {
  const maxRetries = aiConfig?.maxRetries ?? getAiConfig().maxRetries;
  const model = aiConfig?.model;
  let lastError = 'respuesta no parseable';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const msgs =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: 'user' as const,
              content: `El intento anterior falló (${lastError}). Devolvé SOLO el JSON válido con la forma pedida, sin texto extra.`,
            },
          ];

    const raw = await callOpenRouter(msgs, { model });
    const json = extractJson(raw);
    if (!json) {
      lastError = 'no se encontró JSON en la respuesta';
      continue;
    }

    const parsed = PuckDataSchema.safeParse(json);
    if (parsed.success) {
      return sanitizePuckData(parsed.data);
    }

    // Fallback tolerante: sanitizar igual; si quedó contenido válido, sirve.
    const sanitized = sanitizePuckData(json);
    if (sanitized.content.length > 0) {
      return sanitized;
    }
    lastError = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
      .slice(0, 300);
  }

  throw new LandingAiError(
    `La IA no devolvió un puck_data válido tras ${maxRetries + 1} intentos. ${lastError}`,
    422,
  );
}

export function generateLandingPuckData(
  input: GenerateLandingInput,
  aiConfig?: AiTextConfig,
): Promise<PuckData> {
  if (!input.brief?.trim()) {
    throw new LandingAiError('El brief es obligatorio para generar una landing.', 400);
  }
  return runPuckGeneration(buildGenerateMessages(input), aiConfig);
}

export function improveLandingCopy(
  input: ImproveCopyInput,
  aiConfig?: AiTextConfig,
): Promise<PuckData> {
  if (!input.instruction?.trim()) {
    throw new LandingAiError('La instrucción es obligatoria.', 400);
  }
  return runPuckGeneration(buildImproveCopyMessages(input), aiConfig);
}

export function translateLanding(
  input: TranslateInput,
  aiConfig?: AiTextConfig,
): Promise<PuckData> {
  if (!input.targetLocale?.trim()) {
    throw new LandingAiError('El locale destino es obligatorio.', 400);
  }
  return runPuckGeneration(buildTranslateMessages(input), aiConfig);
}

const SeoSchema = z
  .object({
    title: z.string().optional().default(''),
    description: z.string().optional().default(''),
    image: z.string().optional().default(''),
    noindex: z.boolean().optional().default(false),
  })
  .strip();

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

export async function generateLandingSeo(
  input: SeoInput,
  aiConfig?: AiTextConfig,
): Promise<LandingSeo> {
  const raw = await callOpenRouter(buildSeoMessages(input), { model: aiConfig?.model });
  const json = extractJson(raw);
  const parsed = SeoSchema.safeParse(json ?? {});
  const data = parsed.success ? parsed.data : { title: '', description: '', image: '', noindex: false };
  return {
    title: stripTags(data.title).slice(0, 70),
    description: stripTags(data.description).slice(0, 180),
    image: /^(javascript|data|vbscript|file):/i.test(data.image) ? '' : data.image.trim().slice(0, 2000),
    noindex: Boolean(data.noindex),
  };
}
