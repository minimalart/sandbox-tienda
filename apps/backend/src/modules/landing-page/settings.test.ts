import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLandingAiSettings } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests, así que se ejercita
 * el tramo **env > default** — el comportamiento que la migración preservaba.
 *
 * Lo que importa acá no es el modelo por defecto: es que la API key salga del
 * namespace del ASISTENTE IA y no de una lectura propia de `process.env`. Si
 * alguien "simplifica" eso, rotar la key desde la card del asistente arregla el
 * chat y deja al generador de landings tirando 503 con la vieja, sin ninguna
 * pista de por qué.
 */

function withEnv(vars: Record<string, string | undefined>, body: () => void): void {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    body();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const SIN_ENV = {
  OPENROUTER_API_KEY: undefined,
  OPENROUTER_SITE_URL: undefined,
  OPENROUTER_MODEL: undefined,
  LANDING_AI_MAX_RETRIES: undefined,
};

test('sin entorno, los defaults son los que tenía el código viejo', () => {
  withEnv(SIN_ENV, () => {
    const s = getLandingAiSettings();
    assert.equal(s.model, 'openai/gpt-4.1-mini');
    assert.equal(s.maxRetries, 2);
    assert.equal(s.apiKey, '');
    assert.equal(s.siteUrl, 'https://mercatto.minimalart.studio');
  });
});

test('la API key la aporta el namespace del Asistente IA, no una lectura propia', () => {
  withEnv({ ...SIN_ENV, OPENROUTER_API_KEY: 'sk-del-asistente' }, () => {
    assert.equal(getLandingAiSettings().apiKey, 'sk-del-asistente');
  });
});

test('el modelo de texto es PROPIO: CHAT_AI_MODEL no lo mueve', () => {
  // Es el error clásico con estos dos: `OPENROUTER_MODEL` es el de landings y
  // `CHAT_AI_MODEL` el del chat del asistente. Comparten proveedor, no valor.
  withEnv({ ...SIN_ENV, CHAT_AI_MODEL: 'openai/gpt-5-mini' }, () => {
    assert.equal(getLandingAiSettings().model, 'openai/gpt-4.1-mini');
  });
  withEnv({ ...SIN_ENV, OPENROUTER_MODEL: 'anthropic/claude-3.5-sonnet' }, () => {
    assert.equal(getLandingAiSettings().model, 'anthropic/claude-3.5-sonnet');
  });
});

test('los reintentos nunca son negativos', () => {
  // Era `Math.max(0, parsedRetries)`. Un negativo que se colara haría que el bucle
  // del generador no corriera ni una vez y la landing fallara sin intentar.
  withEnv({ ...SIN_ENV, LANDING_AI_MAX_RETRIES: '-3' }, () => {
    assert.equal(getLandingAiSettings().maxRetries, 0);
  });
});

test('un valor de reintentos no numérico cae al default y no a NaN', () => {
  withEnv({ ...SIN_ENV, LANDING_AI_MAX_RETRIES: 'dos' }, () => {
    assert.equal(getLandingAiSettings().maxRetries, 2);
  });
});

test('cero reintentos es una configuración válida, no "sin configurar"', () => {
  withEnv({ ...SIN_ENV, LANDING_AI_MAX_RETRIES: '0' }, () => {
    assert.equal(getLandingAiSettings().maxRetries, 0);
  });
});
