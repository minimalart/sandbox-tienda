import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiConfigSeed, getInPersonSalesChannelName } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío, así que se ejercita el tramo
 * **env > default**.
 *
 * `service.ts` NO se importa acá a propósito: arrastra `MedusaService` y los
 * modelos de MikroORM, y estos tests corren con `node:test` sin base. Es el mismo
 * criterio de `site-settings.test.ts`, que directamente lee el service como
 * texto. Lo que se puede probar de verdad —y es lo que importa— es de dónde sale
 * cada semilla.
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
  IN_PERSON_SC_NAME: undefined,
  CHAT_AI_MODEL: undefined,
  CHAT_AI_MAX_TOKENS: undefined,
  CHAT_AI_REASONING_EFFORT: undefined,
  EMBEDDINGS_MODEL: undefined,
  OPENROUTER_MODEL: undefined,
  LANDING_AI_MAX_RETRIES: undefined,
};

test('el nombre del canal presencial conserva el default histórico', () => {
  // Cambiarlo renombra el canal que busca el script, y como la búsqueda es por
  // nombre EXACTO, una instalación viva se encontraría con un canal duplicado.
  withEnv(SIN_ENV, () => {
    assert.equal(getInPersonSalesChannelName(), 'Presencial supermercado');
  });
});

test('el entorno sigue pisando el nombre del canal', () => {
  withEnv({ ...SIN_ENV, IN_PERSON_SC_NAME: 'Presencial mayorista' }, () => {
    assert.equal(getInPersonSalesChannelName(), 'Presencial mayorista');
  });
});

/**
 * El punto de todo el archivo: la semilla de `ai_config` la aportan los
 * namespaces DUEÑOS. Antes eran `process.env` leídas acá, en un `const` de nivel
 * superior, y por lo tanto congeladas al arranque.
 */
test('la semilla del chat viene del namespace del Asistente IA', () => {
  withEnv({ ...SIN_ENV, CHAT_AI_MODEL: 'moonshotai/kimi-k2', CHAT_AI_MAX_TOKENS: '9000' }, () => {
    const seed = aiConfigSeed();
    assert.equal(seed.chatModel, 'moonshotai/kimi-k2');
    assert.equal(seed.chatMaxTokens, 9000);
  });
});

test('la semilla del texto viene del namespace de Landings, no del asistente', () => {
  // `OPENROUTER_MODEL` es de landings pese al prefijo; `CHAT_AI_MODEL` es del chat.
  // Confundirlos haría que las landings salieran con el modelo del asistente.
  withEnv(
    { ...SIN_ENV, OPENROUTER_MODEL: 'anthropic/claude-3.5-sonnet', CHAT_AI_MODEL: 'openai/gpt-5-mini' },
    () => {
      const seed = aiConfigSeed();
      assert.equal(seed.textModel, 'anthropic/claude-3.5-sonnet');
      assert.equal(seed.chatModel, 'openai/gpt-5-mini');
    },
  );
});

test('la semilla del modelo de embeddings viene del Asistente IA', () => {
  withEnv({ ...SIN_ENV, EMBEDDINGS_MODEL: 'openai/text-embedding-3-large' }, () => {
    assert.equal(aiConfigSeed().embeddingsModel, 'openai/text-embedding-3-large');
  });
});

/**
 * `mergeAiConfig` normaliza con `clampInt`, que descarta lo no finito — pero un
 * `NaN` viajando por el tipo `number` es una bomba de tiempo: el día que alguien
 * lo compare con `>` en vez de pasarlo por el clamp, la comparación da `false`
 * siempre y nadie se entera. La semilla entrega `undefined` o un número, nunca NaN.
 */
test('un valor no numérico nunca sale como NaN de la semilla', () => {
  withEnv({ ...SIN_ENV, CHAT_AI_MAX_TOKENS: 'muchos', LANDING_AI_MAX_RETRIES: 'dos' }, () => {
    const seed = aiConfigSeed();
    assert.ok(seed.chatMaxTokens === undefined || Number.isFinite(seed.chatMaxTokens));
    assert.ok(seed.textMaxRetries === undefined || Number.isFinite(seed.textMaxRetries));
  });
});

test('un cero configurado llega como cero y no como ausente', () => {
  // `clampInt(0, 2, 0, 5)` da 0 y `clampInt(undefined, 2, 0, 5)` da 2: si la
  // semilla confundiera los dos, pedir "sin reintentos" daría dos reintentos.
  withEnv({ ...SIN_ENV, LANDING_AI_MAX_RETRIES: '0' }, () => {
    assert.equal(aiConfigSeed().textMaxRetries, 0);
  });
});
