import aiAssistantDescriptors from '../app-settings/descriptors/ai-assistant';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva del Asistente IA, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * ─── POR QUÉ ES SINCRÓNICA Y NO TIENE CAMINO ASYNC POR `PG_CONNECTION` ──────
 *
 * `kapso-whatsapp/settings.ts` tiene DOS entradas —una del snapshot y otra por
 * knex crudo— y eso NO es el patrón por defecto, es la excepción: existe porque
 * el notification provider corre en el contenedor hermético que arma
 * `load-internal.js`, donde `container.resolve(APP_SETTINGS_MODULE)` tira
 * siempre. Acá no hay ningún consumidor así. Los cinco que hay son todos
 * sincrónicos y corren en un proceso normal:
 *
 *  - `ai/chat-client.ts`      → se llama desde adentro de un `fetch` ya armado.
 *  - `ai/embedding-client.ts` → ídem, y encima desde un bucle de sub-lotes.
 *  - `api/mcp/middlewares.ts` → camino caliente de cada request MCP.
 *  - `jobs/generate-proposals.ts` y `jobs/embed-pending-memories.ts` → corren en
 *    el WORKER, que es el caso que motiva el camino async de kapso… pero acá el
 *    snapshot alcanza igual: `snapshot.ts` revalida solo cada 30 s
 *    (`revalidateIfStale`), así que el worker converge sin knex. Lo que el
 *    provider de kapso no puede hacer es TENER snapshot; el worker sí lo tiene.
 *
 * Agregar un `loadAiAssistantSettingsViaPg()` que no llama nadie sería una
 * segunda definición de la precedencia esperando a divergir de esta. Cuando
 * aparezca un consumidor hermético de verdad, el molde está en `kapso-whatsapp`.
 *
 * Lee del snapshot que el loader de `app-settings` llena al arrancar; hasta
 * entonces cae a `process.env`, o sea que se comporta exactamente como antes de
 * esta migración. Ver la nota de `app-settings/snapshot.ts`.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra. El bundle
 * del admin importa `descriptors/ai-assistant`, nunca esto.
 *
 * ─── QUÉ NO ESTÁ ACÁ ────────────────────────────────────────────────────────
 *
 * La configuración de IA POR TIENDA —`ai_config.chat_model`, la memoria, los
 * modelos de imagen— vive en `store-config` y se edita en Preferencias → IA. Lo
 * de acá es la capa de INSTANCIA: el default sobre el que `mergeAiConfig`
 * mergea, y el valor que usan los call sites que no resuelven `store-config`.
 * Las dos capas, y por qué son dos, están en el encabezado del descriptor.
 */

export type ChatReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type ProposalsEngine = 'specialists' | 'simple';

export type AiAssistantSettings = {
  /** Credencial de OpenRouter. `''` = el asistente responde 503. */
  openrouterApiKey: string;
  /** `HTTP-Referer` de atribución. Nunca vacío: tiene default en el descriptor. */
  openrouterSiteUrl: string;

  /** Modelo del chat cuando el call site no pasa uno explícito. */
  chatModel: string;
  /** Presupuesto de tokens de salida por turno (incluye reasoning tokens). */
  chatMaxTokens: number;
  chatReasoningEffort: ChatReasoningEffort;

  /** Key propia de embeddings. `''` = usar la de OpenRouter. */
  embeddingsApiKey: string;
  /** Base del proveedor, SIN `/embeddings` y sin barra final. */
  embeddingsBaseUrl: string;
  embeddingsModel: string;

  proposalsEngine: ProposalsEngine;
  proposalsLimit: number;
  proposalsSpecialistSteps: number;
  proposalsMaxSteps: number;
  /** Clave de agente única, para diagnóstico. `''` = comportamiento normal. */
  proposalsAgent: string;

  /** Token compartido de fallback para `/mcp`. `''` si no hay ninguno. */
  mcpAuthToken: string;
  /** Base pública del callback OAuth, sin barra final. `''` si no está. */
  mcpOauthRedirectBase: string;
};

const byKey = new Map(aiAssistantDescriptors.settings.map((d) => [d.key, d]));

/**
 * Los defaults viven en el DESCRIPTOR, no acá: `resolveSettingSync` ya los aplica
 * como último eslabón de la precedencia. Los `fallback` de estas dos funciones son
 * sólo la red para el caso "la key no existe en el descriptor" (un rename a medio
 * hacer), y por eso repiten el mismo valor en vez de inventar otro.
 */
function readString(key: string, fallback = ''): string {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
}

function readNumber(key: string, fallback: number): number {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  // `coerceFromEnv` ya devuelve `number` para los descriptores numéricos; el
  // `parseFloat` cubre una fila guardada como string antes de que existiera la card.
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export function getAiAssistantSettings(): AiAssistantSettings {
  const effort = readString('CHAT_AI_REASONING_EFFORT', 'low').toLowerCase();
  const engine = readString('AI_PROPOSALS_ENGINE', 'specialists');

  return {
    openrouterApiKey: readString('OPENROUTER_API_KEY'),
    openrouterSiteUrl: readString('OPENROUTER_SITE_URL', 'https://mercatto.minimalart.studio'),

    chatModel: readString('CHAT_AI_MODEL', 'openai/gpt-5-mini'),
    // El piso en 1 conserva el comportamiento viejo de `getMaxTokens()`
    // (`n > 0 ? n : 6000`): un `CHAT_AI_MAX_TOKENS=0` heredado del entorno tiene
    // que seguir cayendo al default en vez de mandar un presupuesto de cero, que
    // el proveedor acepta y responde vacío.
    chatMaxTokens: positiveOr(readNumber('CHAT_AI_MAX_TOKENS', 6000), 6000),
    chatReasoningEffort: isEffort(effort) ? effort : 'low',

    embeddingsApiKey: readString('EMBEDDINGS_API_KEY'),
    embeddingsBaseUrl: readString('EMBEDDINGS_BASE_URL', 'https://openrouter.ai/api/v1').replace(
      /\/+$/,
      '',
    ),
    embeddingsModel: readString('EMBEDDINGS_MODEL', 'openai/text-embedding-3-small'),

    proposalsEngine: engine === 'simple' ? 'simple' : 'specialists',
    proposalsLimit: positiveOr(readNumber('AI_PROPOSALS_LIMIT', 3), 3),
    proposalsSpecialistSteps: positiveOr(readNumber('AI_PROPOSALS_SPECIALIST_STEPS', 6), 6),
    proposalsMaxSteps: positiveOr(readNumber('AI_PROPOSALS_MAX_STEPS', 12), 12),
    proposalsAgent: readString('AI_PROPOSALS_AGENT'),

    mcpAuthToken: readString('MCP_AUTH_TOKEN'),
    mcpOauthRedirectBase: readString('MCP_OAUTH_REDIRECT_BASE').replace(/\/+$/, ''),
  };
}

/**
 * `<= 0` no es un valor usable para ninguno de estos cuatro topes —cero pasos es
 * un agente que no analiza nada, cero tokens es una respuesta vacía— así que se
 * cae al default en vez de propagarlo.
 */
export function positiveOr(value: number, fallback: number): number {
  return value > 0 ? value : fallback;
}

function isEffort(value: string): value is ChatReasoningEffort {
  return value === 'minimal' || value === 'low' || value === 'medium' || value === 'high';
}

/**
 * Credencial + endpoint de embeddings ya resueltos, con el encadenamiento que
 * hacía `getEmbeddingConfig()`: sin key propia se usa la de OpenRouter. Vive acá
 * y no en el cliente para que ese fallback tenga UN solo lugar — tenerlo en el
 * cliente y en el job daría dos cadenas que pueden desalinearse.
 */
export function getEmbeddingCredentials(settings: AiAssistantSettings): {
  apiKey: string;
  baseUrl: string;
  model: string;
} {
  return {
    apiKey: settings.embeddingsApiKey || settings.openrouterApiKey,
    baseUrl: settings.embeddingsBaseUrl,
    model: settings.embeddingsModel,
  };
}
