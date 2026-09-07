import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_ASSISTANT_SETTINGS_NAMESPACE } from './foreign.ts';
import {
  FOREIGN_SETTING_BRIDGE_KEY,
  __unpublishForeignSettingBridge,
  publishForeignSettingBridge,
  type ForeignSettingReader,
} from './plugin-bridge.ts';

/**
 * El puente es lo único que le permite a un plugin de `packages/plugins/*` ver
 * un ajuste guardado en la base en vez de sólo `process.env`.
 *
 * Lo que se prueba acá es el CONTRATO que cruza el límite de paquetes, porque
 * del otro lado hay un string literal repetido a mano
 * (`packages/plugins/<id>/src/lib/host-settings.ts`) y no un import: si la firma o
 * el nombre cambian sin que el otro lado se entere, el plugin no rompe el build
 * — degrada al entorno en silencio, que es exactamente el bug de DESDEELSUR-46.
 *
 * El snapshot arranca vacío en los tests, así que se ejercita el tramo
 * env > default, que es el que el puente tiene que preservar tal cual.
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

/** Cómo lo busca el plugin: por el nombre literal, sin importar nada del host. */
const readAsPluginWould = (): ForeignSettingReader | null => {
  const candidate = (globalThis as unknown as Record<string, unknown>)[
    '__mercattoForeignSettingReader_v1'
  ];
  return typeof candidate === 'function' ? (candidate as ForeignSettingReader) : null;
};

test('el nombre exportado y el literal que copia el plugin son el mismo', () => {
  // Si esto se cae, hay que actualizar TODOS los `host-settings.ts` de
  // `packages/plugins/*` en el mismo commit. Es el único chequeo automático que
  // ata las dos mitades del contrato.
  assert.equal(FOREIGN_SETTING_BRIDGE_KEY, '__mercattoForeignSettingReader_v1');
});

test('sin publicar, el plugin no encuentra nada y cae al entorno', () => {
  __unpublishForeignSettingBridge();
  assert.equal(readAsPluginWould(), null);
});

test('publicado, el plugin resuelve un ajuste por namespace + key', () => {
  __unpublishForeignSettingBridge();
  publishForeignSettingBridge();
  const read = readAsPluginWould();
  assert.ok(read, 'el puente tiene que estar en globalThis después de publicarlo');

  withEnv({ CHAT_AI_MODEL: undefined }, () => {
    // El default vive en el descriptor del DUEÑO: es la diferencia con leer
    // `process.env` a mano, donde el plugin no tenía forma de conocerlo.
    assert.equal(read(AI_ASSISTANT_SETTINGS_NAMESPACE, 'CHAT_AI_MODEL'), 'openai/gpt-5-mini');
  });

  __unpublishForeignSettingBridge();
});

test('el puente respeta la cadena de fallback que le pasa el plugin', () => {
  __unpublishForeignSettingBridge();
  publishForeignSettingBridge();
  const read = readAsPluginWould();
  assert.ok(read);

  // `envFallback` cruza el puente como array posicional, no como objeto de
  // opciones: el plugin no comparte tipos con el host.
  withEnv({ EMBEDDINGS_API_KEY: undefined, OPENROUTER_API_KEY: 'sk-compartida' }, () => {
    assert.equal(
      read('extension:no-instalada', 'EMBEDDINGS_API_KEY', [
        'EMBEDDINGS_API_KEY',
        'OPENROUTER_API_KEY',
      ]),
      'sk-compartida',
    );
  });

  __unpublishForeignSettingBridge();
});

test('sin fila ni entorno devuelve vacío, nunca undefined', () => {
  // El plugin hace `Boolean(openRouterKey())` y `|| default`: si esto devolviera
  // `undefined` los `if (!key)` del catalogador seguirían funcionando, pero un
  // `.trim()` del otro lado explotaría. El contrato es string SIEMPRE.
  __unpublishForeignSettingBridge();
  publishForeignSettingBridge();
  const read = readAsPluginWould();
  assert.ok(read);

  withEnv({ OPENROUTER_API_KEY: undefined }, () => {
    assert.equal(read('extension:no-instalada', 'OPENROUTER_API_KEY'), '');
  });

  __unpublishForeignSettingBridge();
});

test('publicar dos veces es idempotente', () => {
  // El loader puede correr más de una vez (varias réplicas, un reload en dev).
  __unpublishForeignSettingBridge();
  publishForeignSettingBridge();
  publishForeignSettingBridge();
  assert.ok(readAsPluginWould());
  __unpublishForeignSettingBridge();
});

test('un lector inyectado reemplaza al real: el puente no ata a nadie a foreign.ts', () => {
  // Es lo que hace testeable el lado del plugin sin levantar app-settings.
  __unpublishForeignSettingBridge();
  publishForeignSettingBridge((namespace, key) => `${namespace}/${key}`);
  const read = readAsPluginWould();
  assert.ok(read);
  assert.equal(read('ns', 'KEY'), 'ns/KEY');
  __unpublishForeignSettingBridge();
});
