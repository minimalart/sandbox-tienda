/**
 * Cliente OpenRouter self-contained del Catalogador.
 *
 * Deliberadamente NO importa los clientes del Asistente IA ni de landing-page:
 * el PRD §23.1 exige que el Catalogador no quede acoplado al chat/agentes, y el
 * sistema de composición de extensiones penaliza depender de esas extensiones
 * enteras sólo para reusar un wrapper fino. Reutiliza la MISMA infra (OpenRouter,
 * `OPENROUTER_API_KEY`, nano-banana para imágenes) replicando un cliente mínimo.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Las credenciales de OpenRouter salen del namespace del Asistente IA, que es su
 * DUEÑO (`descriptors/ai-assistant.ts`), con precedencia DB cifrada > env.
 *
 * Este archivo tuvo un stub que leía `process.env` a secas, porque al migrar a
 * plugin se perdió el acceso a `app-settings/*`. Costó DESDEELSUR-46: la key
 * guardada y cifrada en la base desde el 19/08, `env_present: false`, el chat del
 * asistente andando y el catalogador tirando 503 en cada intento de generar
 * textos. El puente de `lib/host-settings.ts` cierra eso y mantiene la degradación
 * al entorno cuando el host no tiene `app-settings`.
 */
import {
  AI_ASSISTANT_SETTINGS_NAMESPACE,
  readForeignSetting,
} from '../../../lib/host-settings';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 45_000;

export class CatalogadorAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'CatalogadorAiError';
    this.status = status;
  }
}

/**
 * La key sale del descriptor del Asistente IA, que es su DUEÑO, y sólo cae al
 * entorno si ese namespace no está instalado.
 *
 * Antes esto leía `process.env` directo, y el encabezado de `descriptors/catalogador.ts`
 * ya decía que la key "se gestiona en un namespace propio" — pero ese namespace no
 * existía. Ahora que existe y la card la deja rotar, seguir leyendo el entorno sería
 * peor que antes: el operador rota la key, el chat del asistente empieza a andar con
 * la nueva y el catalogador sigue con la vieja, tirando 503 sin que nada lo relacione
 * con lo que acaba de guardar.
 *
 * El camino son DOS saltos que degradan solos, y ninguno es un import del host:
 * `lib/host-settings.ts` busca el puente en `globalThis` (no está → entorno), y
 * el puente busca el descriptor por DATO con `findDescriptor` (el asistente no
 * está instalado → entorno). Un proyecto generado sin `app-settings`, o sin el
 * asistente, se comporta exactamente como antes de esta migración.
 *
 * Durante la etapa de plugin sin puente este cartel describía algo que el código
 * NO hacía: leía `process.env` a secas. Es lo que costó DESDEELSUR-46 — un cartel
 * que promete precedencia y un stub que la ignora no se contradicen en ninguna
 * pantalla, sólo en producción.
 */
const openRouterKey = (): string =>
  readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'OPENROUTER_API_KEY');

export function isAiConfigured(): boolean {
  return Boolean(openRouterKey());
}

function apiKey(): string {
  const key = openRouterKey();
  if (!key) throw new CatalogadorAiError('OPENROUTER_API_KEY no está configurada.', 503);
  return key;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${apiKey()}`,
    'Content-Type': 'application/json',
  };
  // Misma dueña que la key: si se leyera del entorno, la atribucion del consumo en
  // el dashboard de OpenRouter apuntaria a una URL vieja despues de cambiarla.
  const site = readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'OPENROUTER_SITE_URL');
  if (site) {
    h['HTTP-Referer'] = site;
    h['X-Title'] = 'Mercatto Catalogador';
  }
  return h;
}

export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /**
   * Costo real cobrado por OpenRouter para esa llamada, en USD (credits).
   * Viene SIEMPRE en la respuesta: el viejo `usage: { include: true }` quedó
   * deprecado y no hace falta pedirlo.
   */
  cost?: number;
  cost_details?: { upstream_inference_cost?: number | null } | null;
};

/**
 * Costo/consumo acumulado de un tramo de trabajo (p.ej. todas las llamadas de
 * un producto de una ejecución). Se arma con `withAiUsageTracking`, que no
 * requiere que las funciones intermedias del pipeline devuelvan el `usage`.
 */
export type AiUsageBreakdown = {
  total_usd: number;
  text_usd: number;
  image_usd: number;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  by_model: Record<string, { calls: number; usd: number }>;
  /**
   * true si alguna respuesta no informó costo: el total es un PISO, no el
   * costo exacto (así la UI puede mostrarlo como aproximado).
   */
  missing_cost: boolean;
};

export function emptyAiUsage(): AiUsageBreakdown {
  return {
    total_usd: 0,
    text_usd: 0,
    image_usd: 0,
    calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    by_model: {},
    missing_cost: false,
  };
}

/** Redondeo a 6 decimales: los costos por llamada son del orden de 1e-4 USD. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Suma dos acumulados (para agregar productos → ejecución). */
export function mergeAiUsage(a: AiUsageBreakdown | null | undefined, b: AiUsageBreakdown | null | undefined): AiUsageBreakdown {
  const base = a ?? emptyAiUsage();
  const add = b ?? emptyAiUsage();
  const by_model: AiUsageBreakdown['by_model'] = {};
  for (const [model, v] of [...Object.entries(base.by_model ?? {}), ...Object.entries(add.by_model ?? {})]) {
    const prev = by_model[model] ?? { calls: 0, usd: 0 };
    by_model[model] = { calls: prev.calls + v.calls, usd: round6(prev.usd + v.usd) };
  }
  return {
    total_usd: round6(base.total_usd + add.total_usd),
    text_usd: round6(base.text_usd + add.text_usd),
    image_usd: round6(base.image_usd + add.image_usd),
    calls: base.calls + add.calls,
    prompt_tokens: base.prompt_tokens + add.prompt_tokens,
    completion_tokens: base.completion_tokens + add.completion_tokens,
    by_model,
    missing_cost: Boolean(base.missing_cost || add.missing_cost),
  };
}

const usageStore = new AsyncLocalStorage<AiUsageBreakdown>();

/**
 * Abre un ámbito de medición: `usage` es el objeto que se va llenando con el
 * costo de TODAS las llamadas a OpenRouter que ocurran dentro de `run()`
 * (texto e imagen, a cualquier profundidad del pipeline).
 *
 * Se usa AsyncLocalStorage a propósito: el pipeline de imágenes encadena varias
 * funciones (recorte → fondo → composición) y hacer que cada una devuelva su
 * `usage` obligaría a cambiar toda la cadena de firmas.
 *
 * El llamador conserva la referencia a `usage`, así que también puede leer el
 * gasto cuando `run()` lanza: lo consumido antes del error ya se cobró.
 */
export function createAiUsageScope(): {
  usage: AiUsageBreakdown;
  run: <T>(fn: () => Promise<T>) => Promise<T>;
} {
  const usage = emptyAiUsage();
  return { usage, run: (fn) => usageStore.run(usage, fn) };
}

/** Acumulado del tramo en curso (null fuera de `withAiUsageTracking`). */
export function getAiUsage(): AiUsageBreakdown | null {
  return usageStore.getStore() ?? null;
}

/** Imputa el consumo de una llamada al acumulado en curso (si hay uno). */
function recordUsage(kind: 'text' | 'image', model: string, usage: ChatUsage | undefined): void {
  const acc = usageStore.getStore();
  if (!acc) return;
  const usd = typeof usage?.cost === 'number' && Number.isFinite(usage.cost) ? usage.cost : null;
  acc.calls += 1;
  acc.prompt_tokens += usage?.prompt_tokens ?? 0;
  acc.completion_tokens += usage?.completion_tokens ?? 0;
  if (usd === null) {
    acc.missing_cost = true;
  } else {
    acc.total_usd = round6(acc.total_usd + usd);
    if (kind === 'text') acc.text_usd = round6(acc.text_usd + usd);
    else acc.image_usd = round6(acc.image_usd + usd);
  }
  const prev = acc.by_model[model] ?? { calls: 0, usd: 0 };
  acc.by_model[model] = { calls: prev.calls + 1, usd: round6(prev.usd + (usd ?? 0)) };
}

export type ChatMessage =
  | { role: 'system' | 'assistant'; content: string }
  | {
      role: 'user';
      content:
        | string
        | Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
          >;
    };

async function postWithRetry(body: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      // Reintentar sólo en 408/429/5xx
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        lastErr = new CatalogadorAiError(`OpenRouter respondió ${res.status}`, 502);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1) ** 2));
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1) ** 2));
    }
  }
  throw lastErr instanceof Error ? lastErr : new CatalogadorAiError('OpenRouter no respondió.', 502);
}

/** Una vuelta de chat-completions (texto o visión). Devuelve texto + usage. */
export async function chatComplete(opts: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  jsonMode?: boolean;
}): Promise<{ content: string; usage?: ChatUsage; finishReason?: string | null }> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    max_tokens: opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : 1500,
  };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (opts.reasoningEffort) body.reasoning = { effort: opts.reasoningEffort };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const res = await postWithRetry(body);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new CatalogadorAiError(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`, 502);
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
    usage?: ChatUsage;
  } | null;
  const choice = data?.choices?.[0];
  recordUsage('text', opts.model, data?.usage);
  return {
    content: choice?.message?.content ?? '',
    usage: data?.usage,
    finishReason: choice?.finish_reason ?? null,
  };
}

export type GeneratedImage = { bytes: Buffer; mimeType: string };

/**
 * Genera/recrea una imagen con un modelo multimodal (nano-banana / Gemini 2.5
 * Flash Image). `referenceImages` son data URLs que el modelo usa como base para
 * mantener fiel el producto (recreación/lifestyle).
 */
export async function generateImage(opts: {
  model: string;
  prompt: string;
  referenceImages?: string[];
}): Promise<GeneratedImage> {
  const refs = (opts.referenceImages ?? []).filter((u) => typeof u === 'string' && u.startsWith('data:'));
  const userContent =
    refs.length > 0
      ? [
          { type: 'text', text: opts.prompt },
          ...refs.map((url) => ({ type: 'image_url', image_url: { url } })),
        ]
      : opts.prompt;

  const body: Record<string, unknown> = {
    model: opts.model,
    modalities: ['image', 'text'],
    messages: [{ role: 'user', content: userContent }],
  };

  const res = await postWithRetry(body, refs.length > 0 ? 60_000 : DEFAULT_TIMEOUT_MS);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new CatalogadorAiError(`OpenRouter (image) ${res.status}: ${txt.slice(0, 300)}`, 502);
  }
  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string } }>;
        content?: Array<{ type?: string; image_url?: { url?: string } }> | string;
      };
    }>;
    usage?: ChatUsage;
  } | null;

  // Se imputa antes de validar la imagen: una respuesta sin imagen igual se cobra.
  recordUsage('image', opts.model, data?.usage);

  const msg = data?.choices?.[0]?.message;
  let dataUrl: string | undefined = msg?.images?.[0]?.image_url?.url;
  if (!dataUrl && Array.isArray(msg?.content)) {
    const part = msg!.content.find((p) => p?.type === 'image_url');
    dataUrl = part?.image_url?.url;
  }
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new CatalogadorAiError('El modelo no devolvió una imagen.', 502);
  }
  const parts = dataUrl.split(',', 2);
  const meta = parts[0] ?? '';
  const b64 = parts[1] ?? '';
  const mimeType = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';')) || 'image/png';
  return { bytes: Buffer.from(b64, 'base64'), mimeType };
}

/**
 * Extrae un objeto JSON del texto del modelo, tolerando fences ```json y ruido.
 * Portado del tool original (robustez de parseo de salida IA).
 */
export function extractJson<T = unknown>(content: string): T | null {
  if (!content) return null;
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
