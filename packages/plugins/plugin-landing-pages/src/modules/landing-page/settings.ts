import { getAppSettingsSyncReader } from '@minimalart/mercatto-plugin-runtime';

/** Shared AI account and landing defaults are resolved on each call.
 * Before the host registers its reader, env remains the compatibility fallback. */
export type LandingAiSettings = {
  /** Credencial de OpenRouter. `''` si no está seteada → los clientes tiran 503. */
  apiKey: string;
  /** Modelo de texto para landings y banners. */
  model: string;
  /** Reintentos ante JSON inválido. Nunca negativo. */
  maxRetries: number;
  /** `HTTP-Referer` de atribución. */
  siteUrl: string;
};

const read = (key: string): unknown => {
  const namespace = ['OPENROUTER_API_KEY', 'OPENROUTER_SITE_URL'].includes(key)
    ? 'extension:ai-assistant'
    : 'extension:landing-pages';
  return getAppSettingsSyncReader()?.(namespace, key) ?? process.env[key];
};

const readString = (key: string, fallback: string): string => {
  const raw = read(key);
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed === '' ? fallback : trimmed;
};

const readNumber = (key: string, fallback: number): number => {
  const raw = read(key);
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export function getLandingAiSettings(): LandingAiSettings {
  return {
    apiKey: readString('OPENROUTER_API_KEY', ''),
    model: readString('OPENROUTER_MODEL', 'openai/gpt-4.1-mini'),
    // `Math.max(0, …)` — un valor negativo heredado del entorno se trata como
    // cero, no como un bucle (comportamiento histórico de `getAiConfig()`).
    maxRetries: Math.max(0, readNumber('LANDING_AI_MAX_RETRIES', 2)),
    siteUrl: readString('OPENROUTER_SITE_URL', 'https://mercatto.minimalart.studio'),
  };
}
