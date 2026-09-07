import landingPagesDescriptors from '../app-settings/descriptors/landing-pages';
import {
  AI_ASSISTANT_SETTINGS_NAMESPACE,
  readForeignSetting,
} from '../app-settings/foreign';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva del generador de Landings con IA, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * SINCRÓNICA, como typesense/seo-geo/catalogador: los dos consumidores
 * (`ai/client.ts:getAiConfig` y `ai/image-client.ts:generateImage`) se llaman
 * desde adentro de un `fetch` ya armado, sin contenedor y sin poder esperar una
 * promesa. Lee del snapshot que el loader de `app-settings` llena al arrancar;
 * hasta entonces cae a `process.env`, o sea que se comporta exactamente como
 * antes de esta migración. No tiene camino async por `PG_CONNECTION` porque no
 * hay ningún consumidor en un contenedor hermético — el molde para cuando lo
 * haya está en `kapso-whatsapp/settings.ts`.
 *
 * ─── DOS FUENTES A PROPÓSITO ────────────────────────────────────────────────
 *
 * Los valores PROPIOS (modelo de texto, reintentos) salen del namespace de esta
 * extensión. La credencial y la URL de atribución de OpenRouter salen del
 * namespace del ASISTENTE IA, que es su dueño, vía `readForeignSetting`. No es
 * un atajo: si acá se leyera `process.env.OPENROUTER_API_KEY` a mano, rotar la
 * key desde la card del asistente arreglaría el chat y dejaría al generador de
 * landings tirando 503 con la key vieja. El motivo largo está en el encabezado
 * de `app-settings/foreign.ts`.
 *
 * SERVER-ONLY: importa `resolve.ts`, que lee `process.env` y descifra.
 */

export type LandingAiSettings = {
  /** Credencial de OpenRouter, del namespace del Asistente IA. `''` = 503. */
  apiKey: string;
  /** Modelo de texto para landings y banners. */
  model: string;
  /** Reintentos ante JSON inválido. Nunca negativo. */
  maxRetries: number;
  /** `HTTP-Referer` de atribución, del namespace del Asistente IA. */
  siteUrl: string;
};

const byKey = new Map(landingPagesDescriptors.settings.map((d) => [d.key, d]));

function readString(key: string, fallback: string): string {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed === '' ? fallback : trimmed;
}

function readNumber(key: string, fallback: number): number {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

export function getLandingAiSettings(): LandingAiSettings {
  return {
    apiKey: readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'OPENROUTER_API_KEY'),
    model: readString('OPENROUTER_MODEL', 'openai/gpt-4.1-mini'),
    // `Math.max(0, …)` conserva el comportamiento viejo de `getAiConfig()`: un
    // valor negativo heredado del entorno se trataba como cero, no como un bucle.
    maxRetries: Math.max(0, readNumber('LANDING_AI_MAX_RETRIES', 2)),
    siteUrl:
      readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'OPENROUTER_SITE_URL') ||
      'https://mercatto.minimalart.studio',
  };
}
