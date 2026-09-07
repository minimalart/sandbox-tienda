import { getAiAssistantSettings } from '../settings';
import type { ApiMessage, ToolCall } from './types';

/**
 * Cliente de chat con function-calling vía OpenRouter (compatible OpenAI).
 * Reusa la MISMA API key que el builder de Puck (`OPENROUTER_API_KEY`) pero con
 * su propio modelo (`CHAT_AI_MODEL`, default `openai/gpt-5-mini`).
 *
 * A diferencia del cliente de landing (`modules/landing-page/ai/client.ts`),
 * éste soporta historial multi-turn + `tools` y devuelve el `message` completo
 * (con `tool_calls`), porque el asistente decide qué tool del MCP llamar.
 *
 * Las cuatro variables que gobiernan esto —key, modelo, presupuesto de tokens y
 * esfuerzo de razonamiento— ya no salen de `process.env` sino de
 * `ai-assistant/settings.ts`, o sea de `site_setting` con el entorno de fallback.
 * El cambio no es cosmético: antes, subir `CHAT_AI_MAX_TOKENS` para destrabar el
 * "No pude generar una respuesta" exigía un redeploy.
 *
 * OJO con la precedencia, que tiene DOS niveles y es fácil confundirlos: lo que
 * se lee acá es la capa de INSTANCIA. Todo call site que resuelva `store-config`
 * (las rutas del chat, el job de propuestas) le pasa `model` / `maxTokens` /
 * `reasoningEffort` por argumento desde `ai_config`, que es la capa POR TIENDA y
 * gana. Esto es lo que ven los call sites que no tienen contenedor.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Los modelos de razonamiento (gpt-5*, o*) consumen "reasoning tokens" que
 * cuentan contra `max_tokens`. Con el default chico, el modelo gastaba TODO el
 * presupuesto razonando y devolvía `finish_reason: length` con `content` vacío
 * (sin tool_calls) → el agente caía en "No pude generar una respuesta...". Bajar
 * el esfuerzo de razonamiento y darle aire al presupuesto lo arregla y, de paso,
 * acelera mucho cada vuelta. OpenRouter ignora `reasoning` en modelos que no lo
 * soportan (gpt-4.1-mini / gpt-4o-mini), así que es seguro mandarlo siempre.
 *
 * Los defaults (6000 y `low`) ya no están acá: viven en el descriptor, que es lo
 * que ve la card. Tenerlos en los dos lados es cómo se desalinean.
 */
function getReasoningEffort(): 'minimal' | 'low' | 'medium' | 'high' {
  return getAiAssistantSettings().chatReasoningEffort;
}

function getMaxTokens(): number {
  return getAiAssistantSettings().chatMaxTokens;
}

export type OpenAiTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
};

export class ChatAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * `apiKey` sigue siendo `string | undefined` y no `''`: `isChatAiConfigured()` y
 * los dos `if (!apiKey)` de abajo se apoyan en que sea falsy, y es además la
 * forma pública que ya consumen el job de propuestas y las rutas del chat.
 */
export function getChatAiConfig(): { apiKey: string | undefined; model: string } {
  const settings = getAiAssistantSettings();
  return { apiKey: settings.openrouterApiKey || undefined, model: settings.chatModel };
}

export function isChatAiConfigured(): boolean {
  return Boolean(getChatAiConfig().apiKey);
}

export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

/**
 * POST a OpenRouter con reintentos ante errores TRANSITORIOS (red caída, 408/429/
 * 5xx). Sin esto, un blip del proveedor tiraba abajo el paso de un workflow — y si
 * el paso era uno de los paralelos (portada/productos de la receta), el run entero
 * quedaba `failed` con el borrador a medias. Backoff corto (1s, 2s): el que llama
 * suele ser un turno de chat o un subagente; no queremos colgar la UI. Los errores
 * NO transitorios (400/401/403) salen a la primera, como antes. Para streaming el
 * reintento aplica solo hasta obtener la respuesta (antes del primer byte leído).
 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_ATTEMPTS = 3;

async function postOpenRouter(apiKey: string, body: unknown): Promise<Response> {
  let lastError: ChatAiError | null = null;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    let res: Response;
    try {
      res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': getAiAssistantSettings().openrouterSiteUrl,
          'X-Title': 'Mercatto AI Assistant',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastError = new ChatAiError(
        `No se pudo conectar con OpenRouter: ${(err as Error).message}`,
        502,
      );
      continue;
    }
    if (!res.ok && RETRYABLE_STATUS.has(res.status) && attempt < RETRY_ATTEMPTS - 1) {
      const detail = await res.text().catch(() => '');
      lastError = new ChatAiError(
        `OpenRouter respondió ${res.status}: ${detail.slice(0, 400)}`,
        502,
      );
      continue;
    }
    return res;
  }
  throw lastError ?? new ChatAiError('OpenRouter no respondió tras varios intentos.', 502);
}

export type ChatCompletionMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
  /** Por qué cortó el modelo: 'stop' | 'tool_calls' | 'length' | ... */
  finish_reason?: string | null;
  /** Consumo de tokens del turno (para trazabilidad). */
  usage?: ChatUsage;
};

/**
 * Una vuelta de chat-completions. Devuelve el mensaje del assistant (texto y/o
 * tool_calls). El loop agéntico decide si ejecutar tools o cerrar el turno.
 */
export async function chatComplete(opts: {
  model?: string;
  messages: ApiMessage[];
  tools?: OpenAiTool[];
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}): Promise<ChatCompletionMessage> {
  const { apiKey, model } = getChatAiConfig();
  if (!apiKey) {
    throw new ChatAiError('OPENROUTER_API_KEY no está configurada en el backend.', 503);
  }
  const maxTokens = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : getMaxTokens();
  const reasoningEffort = opts.reasoningEffort ?? getReasoningEffort();

  const res = await postOpenRouter(apiKey, {
    model: opts.model || model,
    messages: opts.messages,
    ...(opts.tools && opts.tools.length > 0
      ? { tools: opts.tools, tool_choice: 'auto' }
      : {}),
    max_tokens: maxTokens,
    reasoning: { effort: reasoningEffort },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ChatAiError(`OpenRouter respondió ${res.status}: ${body.slice(0, 400)}`, 502);
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: ChatCompletionMessage; finish_reason?: string | null }>;
    usage?: ChatUsage;
  } | null;

  const choice = data?.choices?.[0];
  const message = choice?.message;
  if (!message) {
    throw new ChatAiError('OpenRouter devolvió una respuesta vacía.', 502);
  }
  return {
    role: 'assistant',
    content: message.content ?? null,
    tool_calls: message.tool_calls,
    finish_reason: choice?.finish_reason ?? null,
    usage: data?.usage,
  };
}

/** Delta de tool_call tal cual lo manda OpenRouter en modo streaming. */
type ToolCallDelta = {
  index: number;
  id?: string;
  type?: 'function';
  function?: { name?: string; arguments?: string };
};

/**
 * Igual que `chatComplete` pero en streaming (`stream: true`): invoca `onToken`
 * con cada fragmento de texto y `onReasoning` con cada fragmento de razonamiento
 * (si el modelo lo expone) a medida que llegan y, al terminar, devuelve el MISMO
 * `ChatCompletionMessage` ensamblado (content + tool_calls + finish_reason + usage).
 * Así el loop agéntico no cambia su lógica: solo gana feedback en vivo. Los
 * `tool_calls` llegan troceados por `index` y hay que concatenar sus `arguments`.
 * El razonamiento es efímero: se emite por `onReasoning` pero NO se acumula en el
 * mensaje devuelto (no se persiste).
 */
export async function chatCompleteStream(
  opts: {
    model?: string;
    messages: ApiMessage[];
    tools?: OpenAiTool[];
    maxTokens?: number;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  },
  onToken?: (text: string) => void,
  onReasoning?: (text: string) => void,
): Promise<ChatCompletionMessage> {
  const { apiKey, model } = getChatAiConfig();
  if (!apiKey) {
    throw new ChatAiError('OPENROUTER_API_KEY no está configurada en el backend.', 503);
  }
  const maxTokens = opts.maxTokens && opts.maxTokens > 0 ? opts.maxTokens : getMaxTokens();
  const reasoningEffort = opts.reasoningEffort ?? getReasoningEffort();

  const res = await postOpenRouter(apiKey, {
    model: opts.model || model,
    messages: opts.messages,
    ...(opts.tools && opts.tools.length > 0
      ? { tools: opts.tools, tool_choice: 'auto' }
      : {}),
    max_tokens: maxTokens,
    reasoning: { effort: reasoningEffort },
    stream: true,
    stream_options: { include_usage: true },
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '');
    throw new ChatAiError(`OpenRouter respondió ${res.status}: ${body.slice(0, 400)}`, 502);
  }

  let content = '';
  let finishReason: string | null = null;
  let usage: ChatUsage | undefined;
  const toolAcc = new Map<number, ToolCall>();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleData = (payload: string) => {
    if (payload === '[DONE]') return;
    let json: {
      choices?: Array<{
        delta?: {
          content?: string | null;
          tool_calls?: ToolCallDelta[];
          // OpenRouter normaliza el razonamiento de los modelos que lo soportan
          // (gpt-5*, o*, etc.) en `reasoning` (string). Algunos proveedores solo
          // lo mandan troceado en `reasoning_details` ({ text } | { summary }).
          reasoning?: string | null;
          reasoning_details?: Array<{ text?: string; summary?: string }> | null;
        };
        finish_reason?: string | null;
      }>;
      usage?: ChatUsage;
    };
    try {
      json = JSON.parse(payload);
    } catch {
      return; // frame parcial/no-JSON: se ignora
    }
    if (json.usage) usage = json.usage;
    const choice = json.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta;
    if (!delta) return;
    if (typeof delta.content === 'string' && delta.content.length > 0) {
      content += delta.content;
      onToken?.(delta.content);
    }
    // Razonamiento (efímero): se emite en vivo y no se acumula en el mensaje.
    if (onReasoning) {
      if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) {
        onReasoning(delta.reasoning);
      } else if (Array.isArray(delta.reasoning_details)) {
        for (const d of delta.reasoning_details) {
          const t = d?.text ?? d?.summary;
          if (typeof t === 'string' && t.length > 0) onReasoning(t);
        }
      }
    }
    for (const tc of delta.tool_calls ?? []) {
      const prev = toolAcc.get(tc.index) ?? {
        id: tc.id ?? '',
        type: 'function' as const,
        function: { name: '', arguments: '' },
      };
      if (tc.id) prev.id = tc.id;
      if (tc.function?.name) prev.function.name = tc.function.name;
      if (tc.function?.arguments) prev.function.arguments += tc.function.arguments;
      toolAcc.set(tc.index, prev);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Las frames SSE vienen como líneas `data: {...}`; las líneas `:` son keep-alive.
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('data:')) handleData(line.slice(5).trim());
    }
  }
  if (buffer.trim().startsWith('data:')) handleData(buffer.trim().slice(5).trim());

  const toolCalls = [...toolAcc.values()].filter((t) => t.function.name);
  return {
    role: 'assistant',
    content: content || null,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    finish_reason: finishReason,
    usage,
  };
}

/**
 * Parámetros de una vuelta de chat-completions. Es la forma que ya tomaban
 * `chatComplete` y `chatCompleteStream`, extraída a un tipo con nombre para que
 * el loop hable con el modelo a través de una interfaz y no de dos bindings de
 * módulo (que no se pueden sustituir en un test).
 */
export type ChatRequest = {
  model?: string;
  messages: ApiMessage[];
  tools?: OpenAiTool[];
  maxTokens?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
};

/**
 * Seam del modelo. La única implementación de producción es
 * `defaultModelProvider` (OpenRouter); en los tests se pasa un doble con un
 * guion de respuestas, que es lo que vuelve testeable al loop agéntico.
 */
export type ModelProvider = {
  complete(req: ChatRequest): Promise<ChatCompletionMessage>;
  stream(
    req: ChatRequest,
    onToken?: (text: string) => void,
    onReasoning?: (text: string) => void,
  ): Promise<ChatCompletionMessage>;
};

/**
 * El provider por defecto ES el comportamiento de siempre: delega en las dos
 * funciones de este módulo. Como el loop lo toma con `?? defaultModelProvider`,
 * es imposible cambiar de modelo sin pasarlo explícitamente.
 */
export const defaultModelProvider: ModelProvider = {
  complete: (req) => chatComplete(req),
  stream: (req, onToken, onReasoning) => chatCompleteStream(req, onToken, onReasoning),
};
