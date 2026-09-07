import storeConfigDescriptors from '../app-settings/descriptors/store-config';
import {
  AI_ASSISTANT_SETTINGS_NAMESPACE,
  readForeignNumber,
  readForeignSetting,
} from '../app-settings/foreign';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de Preferencias que vive en `site_setting`, con la
 * precedencia **DB > env > default** de `app-settings`.
 *
 * OJO — NO CONFUNDIR CON `store_setting`. Este módulo tiene DOS sistemas de
 * configuración y hacen cosas distintas:
 *
 *  - `store_setting` (tabla propia, con `site_id`, `readSetting`/`upsertSetting`)
 *    es lo que edita la pantalla de Preferencias: `ai_config`, `email_branding`,
 *    `password_gate`, los toggles. Es anterior a `app-settings` y no cambia.
 *  - `site_setting` (esto) es la capa de instancia que reemplaza al `.env`.
 *
 * Lo que este archivo aporta es el puente entre los dos: `aiConfigSeed()`
 * devuelve los valores con los que se arma `AI_CONFIG_DEFAULTS`, o sea el objeto
 * sobre el que `mergeAiConfig()` mergea la fila de `ai_config`.
 *
 * ─── POR QUÉ ES UNA FUNCIÓN Y NO UN `const` ────────────────────────────────
 *
 * `AI_CONFIG_DEFAULTS` era un `const` de nivel superior que se evaluaba al
 * IMPORTAR `service.ts`, o sea durante el arranque y antes de que el loader de
 * `app-settings` llenara el snapshot. Mientras leía `process.env` daba igual;
 * ahora que la fuente es la base, un `const` habría congelado el valor del boot y
 * la card habría mentido para siempre. Se resuelve por llamada — son ~8 lookups
 * en un Map, y `mergeAiConfig` no está en ningún camino caliente.
 *
 * ─── POR QUÉ LOS MODELOS SALEN DE OTROS NAMESPACES ─────────────────────────
 *
 * Porque este módulo NO es el dueño de ninguno: los `CHAT_AI_*` y
 * `EMBEDDINGS_MODEL` los edita el Asistente IA y los dos de landings los edita el
 * generador de landings. Acá se LEE el mismo valor efectivo, vía
 * `app-settings/foreign.ts`, que resuelve por namespace en runtime y cae al
 * entorno si esa extensión no está instalada en el proyecto. Sin eso, cargar el
 * modelo en la card del asistente no habría movido este default y el operador
 * tendría dos números distintos para lo mismo.
 *
 * Los seis restantes (`AI_MEMORY_*`, `CHAT_AI_VALIDATION`) no tienen dueño en
 * ningún namespace porque no los lee nadie más: se siguen leyendo del entorno,
 * que es lo que declara el descriptor. Ver su encabezado.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra.
 */

/** Namespace del generador de landings. Constante y no import, igual que el del asistente. */
const LANDING_PAGES_SETTINGS_NAMESPACE = 'extension:landing-pages';

const byKey = new Map(storeConfigDescriptors.settings.map((d) => [d.key, d]));

function readOwn(key: string, fallback: string): string {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? fallback : trimmed;
}

/**
 * Nombre del sales channel presencial que busca (o crea)
 * `scripts/setup-in-person-sales-channel.ts`.
 */
export function getInPersonSalesChannelName(): string {
  return readOwn('IN_PERSON_SC_NAME', 'Presencial supermercado');
}

/**
 * Las seis semillas que vienen de OTRO namespace. Se devuelven crudas —string y
 * number— y las normaliza `mergeAiConfig` con sus propios `clampInt`/`trimTo*`,
 * para que haya UN solo lugar donde se decide el rango válido de cada campo.
 *
 * `''` significa "no hay valor en ningún lado": el que llama aplica su default
 * literal. No se devuelve el default acá porque los de `ai_config` (por ejemplo
 * `openai/gpt-4.1-mini` para el texto) NO son los mismos que los del descriptor
 * dueño, y duplicarlos sería crear una tercera tabla de defaults.
 */
export function aiConfigSeed(): {
  textModel: string;
  textMaxRetries: number | undefined;
  chatModel: string;
  chatReasoningEffort: string;
  chatMaxTokens: number | undefined;
  embeddingsModel: string;
} {
  const ai = AI_ASSISTANT_SETTINGS_NAMESPACE;
  const landings = LANDING_PAGES_SETTINGS_NAMESPACE;
  return {
    textModel: readForeignSetting(landings, 'OPENROUTER_MODEL'),
    textMaxRetries: optional(readForeignNumber(landings, 'LANDING_AI_MAX_RETRIES', Number.NaN)),
    chatModel: readForeignSetting(ai, 'CHAT_AI_MODEL'),
    chatReasoningEffort: readForeignSetting(ai, 'CHAT_AI_REASONING_EFFORT'),
    chatMaxTokens: optional(readForeignNumber(ai, 'CHAT_AI_MAX_TOKENS', Number.NaN)),
    embeddingsModel: readForeignSetting(ai, 'EMBEDDINGS_MODEL'),
  };
}

/**
 * `NaN` → `undefined`. Es lo que distingue "no configurado" de "configurado en
 * cero": `clampInt(undefined, fallback, …)` cae al fallback, y `clampInt(0, …)`
 * lo clampea al mínimo. Devolver `NaN` funcionaría por accidente (`clampInt` lo
 * descarta con `Number.isFinite`) pero deja el `NaN` viajando por el tipo.
 */
function optional(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined;
}
