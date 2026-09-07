import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAiAssistantSettings, getEmbeddingCredentials } from './settings.ts';

/**
 * El snapshot de `app-settings` arranca vacío en los tests, así que estos casos
 * ejercitan el tramo **env > default** del resolver — que es exactamente el
 * comportamiento que la migración tenía que preservar.
 *
 * Lo que se prueba no son los getters: es que las CUATRO normalizaciones que
 * antes vivían desperdigadas en `chat-client.ts`, `embedding-client.ts` y
 * `proposal-engine.ts` sigan dando lo mismo ahora que hay una sola.
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

/** Todas las env que este módulo lee, apagadas: el estado "instalación limpia". */
const SIN_ENV = {
  OPENROUTER_API_KEY: undefined,
  OPENROUTER_SITE_URL: undefined,
  CHAT_AI_MODEL: undefined,
  CHAT_AI_MAX_TOKENS: undefined,
  CHAT_AI_REASONING_EFFORT: undefined,
  EMBEDDINGS_API_KEY: undefined,
  EMBEDDINGS_BASE_URL: undefined,
  EMBEDDINGS_MODEL: undefined,
  AI_PROPOSALS_ENGINE: undefined,
  AI_PROPOSALS_LIMIT: undefined,
  AI_PROPOSALS_SPECIALIST_STEPS: undefined,
  AI_PROPOSALS_MAX_STEPS: undefined,
  AI_PROPOSALS_AGENT: undefined,
  MCP_AUTH_TOKEN: undefined,
  MCP_OAUTH_REDIRECT_BASE: undefined,
};

test('sin entorno, los defaults son BYTE POR BYTE los que tenía el código viejo', () => {
  // Si uno de estos cambia, cambió el comportamiento de una instalación que no
  // configuró nada — que es la mayoría.
  withEnv(SIN_ENV, () => {
    const s = getAiAssistantSettings();
    assert.equal(s.chatModel, 'openai/gpt-5-mini');
    assert.equal(s.chatMaxTokens, 6000);
    assert.equal(s.chatReasoningEffort, 'low');
    assert.equal(s.embeddingsBaseUrl, 'https://openrouter.ai/api/v1');
    assert.equal(s.embeddingsModel, 'openai/text-embedding-3-small');
    assert.equal(s.openrouterSiteUrl, 'https://mercatto.minimalart.studio');
    assert.equal(s.proposalsEngine, 'specialists');
    assert.equal(s.proposalsLimit, 3);
    assert.equal(s.proposalsSpecialistSteps, 6);
    assert.equal(s.proposalsMaxSteps, 12);
  });
});

test('sin credenciales, todo lo que es secreto queda vacío y no inventa default', () => {
  // Un `type: 'secret'` no puede tener `default` (lo hace cumplir manifest-drift):
  // el contrato es `''`, que es lo que hace que `isChatAiConfigured()` dé false.
  withEnv(SIN_ENV, () => {
    const s = getAiAssistantSettings();
    assert.equal(s.openrouterApiKey, '');
    assert.equal(s.embeddingsApiKey, '');
    assert.equal(s.mcpAuthToken, '');
    assert.equal(s.proposalsAgent, '');
  });
});

test('el entorno le gana al default', () => {
  withEnv(
    {
      ...SIN_ENV,
      CHAT_AI_MODEL: 'moonshotai/kimi-k2',
      CHAT_AI_MAX_TOKENS: '12000',
      AI_PROPOSALS_LIMIT: '7',
    },
    () => {
      const s = getAiAssistantSettings();
      assert.equal(s.chatModel, 'moonshotai/kimi-k2');
      assert.equal(s.chatMaxTokens, 12000);
      assert.equal(s.proposalsLimit, 7);
    },
  );
});

/**
 * El comportamiento viejo era `Number.isFinite(n) && n > 0 ? n : 6000`. Un cero
 * heredado del entorno tiene que seguir cayendo al default: mandarle
 * `max_tokens: 0` al proveedor devuelve una respuesta vacía, que en el chat se ve
 * como "No pude generar una respuesta" y no como un error de configuración.
 */
test('un tope en cero o negativo cae al default en vez de propagarse', () => {
  for (const raw of ['0', '-5']) {
    withEnv({ ...SIN_ENV, CHAT_AI_MAX_TOKENS: raw, AI_PROPOSALS_MAX_STEPS: raw }, () => {
      const s = getAiAssistantSettings();
      assert.equal(s.chatMaxTokens, 6000, `CHAT_AI_MAX_TOKENS=${raw}`);
      assert.equal(s.proposalsMaxSteps, 12, `AI_PROPOSALS_MAX_STEPS=${raw}`);
    });
  }
});

test('un tope no numérico cae al default y nunca sale NaN', () => {
  withEnv({ ...SIN_ENV, CHAT_AI_MAX_TOKENS: 'muchos', AI_PROPOSALS_LIMIT: 'algunas' }, () => {
    const s = getAiAssistantSettings();
    assert.equal(s.chatMaxTokens, 6000);
    assert.equal(s.proposalsLimit, 3);
  });
});

test('el esfuerzo de razonamiento se normaliza y lo inválido no rompe el turno', () => {
  withEnv({ ...SIN_ENV, CHAT_AI_REASONING_EFFORT: 'HIGH' }, () => {
    assert.equal(getAiAssistantSettings().chatReasoningEffort, 'high');
  });
  withEnv({ ...SIN_ENV, CHAT_AI_REASONING_EFFORT: '  Medium ' }, () => {
    assert.equal(getAiAssistantSettings().chatReasoningEffort, 'medium');
  });
  // Un valor inventado no puede tirar: se lo manda a OpenRouter y responde 400.
  withEnv({ ...SIN_ENV, CHAT_AI_REASONING_EFFORT: 'turbo' }, () => {
    assert.equal(getAiAssistantSettings().chatReasoningEffort, 'low');
  });
});

test('el motor de propuestas sólo conmuta con el literal "simple"', () => {
  // Era `engineEnv !== 'simple'`: cualquier otra cosa —incluido un typo— tiene que
  // seguir dando el motor de especialistas, no apagarlo por accidente.
  withEnv({ ...SIN_ENV, AI_PROPOSALS_ENGINE: 'simple' }, () => {
    assert.equal(getAiAssistantSettings().proposalsEngine, 'simple');
  });
  withEnv({ ...SIN_ENV, AI_PROPOSALS_ENGINE: 'simpel' }, () => {
    assert.equal(getAiAssistantSettings().proposalsEngine, 'specialists');
  });
});

test('las URLs se guardan sin barra final', () => {
  // `embeddingsBaseUrl` se concatena con `/embeddings`, y la base del callback
  // OAuth con `/mcp-oauth/callback`: una barra de más da una URL con `//`, que
  // algunos proveedores rechazan y otros redirigen perdiendo el header de auth.
  withEnv(
    {
      ...SIN_ENV,
      EMBEDDINGS_BASE_URL: 'https://api.openai.com/v1///',
      MCP_OAUTH_REDIRECT_BASE: 'https://admin.tienda.com/',
    },
    () => {
      const s = getAiAssistantSettings();
      assert.equal(s.embeddingsBaseUrl, 'https://api.openai.com/v1');
      assert.equal(s.mcpOauthRedirectBase, 'https://admin.tienda.com');
    },
  );
});

/**
 * La cadena `EMBEDDINGS_API_KEY || OPENROUTER_API_KEY` estaba escrita a mano en
 * `embedding-client.ts`. Ahora vive en un solo lugar, y este test es el que
 * impide que alguien la "simplifique".
 */
test('sin key propia de embeddings se usa la de OpenRouter', () => {
  withEnv({ ...SIN_ENV, OPENROUTER_API_KEY: 'sk-chat' }, () => {
    assert.equal(getEmbeddingCredentials(getAiAssistantSettings()).apiKey, 'sk-chat');
  });
});

test('con key propia de embeddings, esa gana', () => {
  withEnv({ ...SIN_ENV, OPENROUTER_API_KEY: 'sk-chat', EMBEDDINGS_API_KEY: 'sk-embed' }, () => {
    assert.equal(getEmbeddingCredentials(getAiAssistantSettings()).apiKey, 'sk-embed');
  });
});

test('sin ninguna key, la credencial de embeddings queda vacía y no undefined', () => {
  withEnv(SIN_ENV, () => {
    assert.equal(getEmbeddingCredentials(getAiAssistantSettings()).apiKey, '');
  });
});
