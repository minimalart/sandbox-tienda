import { getLandingAiSettings } from './settings';
import { LandingAiError } from './types';

/**
 * Cliente AI server-side vía OpenRouter (https://openrouter.ai), que es
 * compatible con la API Chat Completions de OpenAI. Un único cliente alcanza:
 * el modelo se configura (OPENROUTER_MODEL) y puede apuntar a cualquier
 * proveedor (`openai/gpt-4.1-mini`, `anthropic/claude-3.5-sonnet`, etc.).
 *
 * La API key NUNCA se expone al admin/storefront: estas llamadas sólo corren
 * en el backend.
 *
 * Los cuatro valores salen de `landing-page/settings.ts` y no de `process.env`.
 * Los dos propios (modelo, reintentos) se editan en la card de esta extensión;
 * la key y la atribución las edita el Asistente IA, que es su dueño, y acá se lee
 * el MISMO valor —no una copia del entorno— para que rotarla no deje al generador
 * de landings tirando 503 con la vieja. Ver el encabezado de `settings.ts`.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * `apiKey` se devuelve como `string | undefined` y no como `''` porque
 * `isAiConfigured()` y el `if (!apiKey)` de abajo se apoyan en que sea falsy, y
 * porque es la forma pública que ya consumen `generator.ts` y `banner/ai/*`.
 */
export function getAiConfig(): { apiKey: string | undefined; model: string; maxRetries: number } {
  const { apiKey, model, maxRetries } = getLandingAiSettings();
  return { apiKey: apiKey || undefined, model, maxRetries };
}

export function isAiConfigured(): boolean {
  return Boolean(getAiConfig().apiKey);
}

export async function callOpenRouter(
  messages: ChatMessage[],
  opts?: { model?: string },
): Promise<string> {
  const { apiKey, model: defaultModel } = getAiConfig();
  const model = opts?.model?.trim() || defaultModel;
  if (!apiKey) {
    throw new LandingAiError(
      'OPENROUTER_API_KEY no está configurada en el backend.',
      503,
    );
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Headers recomendados por OpenRouter para atribución (opcionales).
        'HTTP-Referer': getLandingAiSettings().siteUrl,
        'X-Title': 'Mercatto Landing Builder',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 4000,
        // Pedimos JSON estricto; modelos que no lo soporten lo ignoran y el
        // generador igual extrae/valida el JSON de la respuesta.
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    throw new LandingAiError(
      `No se pudo conectar con OpenRouter: ${(err as Error).message}`,
      502,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new LandingAiError(
      `OpenRouter respondió ${res.status}: ${body.slice(0, 300)}`,
      502,
    );
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new LandingAiError('OpenRouter devolvió una respuesta vacía.', 502);
  }
  return content;
}
