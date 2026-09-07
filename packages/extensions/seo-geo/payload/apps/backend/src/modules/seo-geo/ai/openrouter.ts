/**
 * Cliente OpenRouter self-contained del módulo SEO & GEO (mismo criterio que
 * `catalogador/ai/openrouter.ts`: no importa el cliente del ai-assistant para no
 * acoplar la extensión). Chat completions con reintentos acotados. Se usa en el
 * Simulador IA (PRD §12) y en las Correcciones asistidas (PRD §15) cuando el
 * Catalogador no está instalado.
 */
import { getSeoGeoSettings } from '../settings';
import { readForeignSetting } from '../../app-settings/foreign';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export class SeoAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Misma historia que en `catalogador/ai/openrouter.ts`, con el mismo comentario:
 * la key la gestiona el Asistente IA y acá se lee el MISMO valor efectivo, no el
 * entorno. Si se leyera el entorno, rotarla desde la card arreglaría el asistente
 * y dejaría a las auditorías de SEO tirando 503.
 */
const openRouterKey = (): string =>
  readForeignSetting('extension:ai-assistant', 'OPENROUTER_API_KEY');

export function isAiConfigured(): boolean {
  return Boolean(openRouterKey());
}

export function getChatModel(): string {
  return getSeoGeoSettings().llmModel;
}

type ChatOptions = {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
};

export async function chatComplete(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const apiKey = openRouterKey();
  if (!apiKey) throw new SeoAiError('OPENROUTER_API_KEY no está configurada.', 503);

  const body = {
    model: opts.model || getChatModel(),
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.max_tokens ?? 1200,
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
  };

  const res = await postWithRetry(`${DEFAULT_BASE_URL.replace(/\/+$/, '')}/chat/completions`, apiKey, body);
  const data = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new SeoAiError('El proveedor de IA devolvió una respuesta vacía.', 502);
  return content;
}

async function postWithRetry(url: string, apiKey: string, body: unknown, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              readForeignSetting('extension:ai-assistant', 'OPENROUTER_SITE_URL') ||
              'https://mercatto.minimalart.studio',
            'X-Title': 'Mercatto SEO & GEO',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (res.ok) return res;
        // Reintentar sólo en errores transitorios
        if (![408, 429, 500, 502, 503, 504].includes(res.status) || i === attempts - 1) {
          const text = await res.text().catch(() => '');
          throw new SeoAiError(`El proveedor de IA respondió ${res.status}: ${text.slice(0, 300)}`, 502);
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      lastErr = err;
      if (err instanceof SeoAiError && err.status !== 502) throw err;
      if (i === attempts - 1) break;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new SeoAiError('Fallo al invocar la IA.', 502);
}
