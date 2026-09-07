import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_ASSISTANT_SETTINGS_NAMESPACE, readForeignNumber, readForeignSetting } from './foreign.ts';

/**
 * `foreign.ts` es la otra mitad de la regla de propiedad: `envOnly` dice "acá no
 * se EDITA", no "acá se ignora la base". Lo que se prueba es justamente el
 * comportamiento del que depende esa afirmación.
 *
 * El snapshot de `app-settings` arranca vacío en los tests, así que estos casos
 * ejercitan el tramo **env > default** — que es exactamente el comportamiento que
 * la migración tenía que preservar.
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

/** Un namespace que no existe: simula un proyecto generado sin esa extensión. */
const AUSENTE = 'extension:no-instalada';

test('con el dueño instalado se lee SU descriptor, no el entorno pelado', () => {
  withEnv({ CHAT_AI_MODEL: 'anthropic/claude-3.5-sonnet' }, () => {
    assert.equal(
      readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'CHAT_AI_MODEL'),
      'anthropic/claude-3.5-sonnet',
    );
  });
});

test('el default del dueño gana cuando no hay ni fila ni env', () => {
  // Es la diferencia con leer `process.env` a mano: el default vive en el
  // descriptor del dueño, así que todos los lectores comparten el mismo.
  withEnv({ CHAT_AI_MODEL: undefined }, () => {
    assert.equal(
      readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'CHAT_AI_MODEL'),
      'openai/gpt-5-mini',
    );
  });
});

/**
 * El caso que hace que esto se pueda usar desde una extensión opcional. Si el
 * dueño no está en el proyecto generado, `findDescriptor()` devuelve `null` y el
 * lector tiene que comportarse EXACTAMENTE como antes de la migración.
 */
test('sin el dueño instalado degrada al entorno, no rompe', () => {
  withEnv({ OPENROUTER_API_KEY: 'sk-del-entorno' }, () => {
    assert.equal(readForeignSetting(AUSENTE, 'OPENROUTER_API_KEY'), 'sk-del-entorno');
  });
});

test('sin dueño y sin entorno devuelve vacío, nunca undefined', () => {
  // Los call sites hacían `process.env.X?.trim() || fallback`: "vacío" y "no
  // configurado" tienen que seguir siendo indistinguibles para no cambiar ningún
  // `if (!apiKey)` del repo.
  withEnv({ OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(readForeignSetting(AUSENTE, 'OPENROUTER_API_KEY'), '');
  });
});

test('la cadena de fallback la decide el que llama, no la key', () => {
  // `EMBEDDINGS_API_KEY` cae a `OPENROUTER_API_KEY`: es una cadena real del repo y
  // no se puede adivinar del nombre de la variable.
  withEnv({ EMBEDDINGS_API_KEY: undefined, OPENROUTER_API_KEY: 'sk-compartida' }, () => {
    assert.equal(
      readForeignSetting(AUSENTE, 'EMBEDDINGS_API_KEY', {
        envFallback: ['EMBEDDINGS_API_KEY', 'OPENROUTER_API_KEY'],
      }),
      'sk-compartida',
    );
  });
  withEnv({ EMBEDDINGS_API_KEY: 'sk-propia', OPENROUTER_API_KEY: 'sk-compartida' }, () => {
    assert.equal(
      readForeignSetting(AUSENTE, 'EMBEDDINGS_API_KEY', {
        envFallback: ['EMBEDDINGS_API_KEY', 'OPENROUTER_API_KEY'],
      }),
      'sk-propia',
    );
  });
});

test('una env definida en blanco cuenta como ausente', () => {
  // Es lo que pasa de verdad cuando un panel de deploy tiene la fila creada y
  // vacía. Mismo criterio que `coerceFromEnv`.
  const envRead = (name: string) => ({ FOO: '   ', BAR: 'valor' })[name];
  assert.equal(readForeignSetting(AUSENTE, 'FOO', { envFallback: ['FOO', 'BAR'], envRead }), 'valor');
});

test('un secreto del dueño sin fila ni env no bloquea la cadena', () => {
  // Un `type: 'secret'` no puede tener `default`, así que resuelve a `undefined`.
  // Si eso cortara la cadena, `EMBEDDINGS_API_KEY` nunca caería a la de OpenRouter.
  withEnv({ EMBEDDINGS_API_KEY: undefined, OPENROUTER_API_KEY: 'sk-compartida' }, () => {
    assert.equal(
      readForeignSetting(AI_ASSISTANT_SETTINGS_NAMESPACE, 'EMBEDDINGS_API_KEY', {
        envFallback: ['EMBEDDINGS_API_KEY', 'OPENROUTER_API_KEY'],
      }),
      'sk-compartida',
    );
  });
});

test('readForeignNumber no propaga NaN', () => {
  withEnv({ LANDING_AI_MAX_RETRIES: 'muchos' }, () => {
    assert.equal(readForeignNumber(AUSENTE, 'LANDING_AI_MAX_RETRIES', 2), 2);
  });
  withEnv({ LANDING_AI_MAX_RETRIES: '4' }, () => {
    assert.equal(readForeignNumber(AUSENTE, 'LANDING_AI_MAX_RETRIES', 2), 4);
  });
});

test('un cero configurado NO se confunde con ausente', () => {
  // `readForeignSetting` devuelve `''` para ausente, así que un `0` tiene que
  // sobrevivir el viaje por string o los reintentos en 0 se volverían 2.
  withEnv({ LANDING_AI_MAX_RETRIES: '0' }, () => {
    assert.equal(readForeignNumber(AUSENTE, 'LANDING_AI_MAX_RETRIES', 2), 0);
  });
});
