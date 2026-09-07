import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  ensureMainStore,
  isMainStore,
  MAIN_STORE_FALLBACK_NAME,
  MAIN_STORE_ID,
  MAIN_STORE_SLUG,
  MAIN_STORE_THEME_SEED,
} from './main-store.ts';
import { DEMO_STORE_MODULE } from './index.ts';

/**
 * La semilla del theme de la tienda principal es una COPIA de
 * `apps/storefront/src/lib/site-config/default.ts`. Una copia sin guard driftea, y
 * el día que driftee el sitio principal se va a renderizar con el branding
 * equivocado: `getTenantBySlug()` mergea SÓLO `assets` con `defaultConfig` —
 * `theme` viene tal cual del backend.
 */
const DEFAULT_TS = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'storefront',
  'src',
  'lib',
  'site-config',
  'default.ts',
);

describe('isMainStore', () => {
  it('true sólo con el booleano en true', () => {
    assert.equal(isMainStore({ is_main: true }), true);
  });

  it('false para una tienda común, null, undefined y el booleano ausente', () => {
    assert.equal(isMainStore({ is_main: false }), false);
    assert.equal(isMainStore({}), false);
    assert.equal(isMainStore(null), false);
    assert.equal(isMainStore(undefined), false);
  });

  it('NO se guía por slug ni por id: sólo el booleano es lo que el índice garantiza', () => {
    // Una fila con el slug/id de la principal pero sin el flag NO es la principal.
    // Si un guard preguntara por slug, alguien podría crear una tienda llamada
    // "principal" y heredar sus protecciones (o perderlas).
    assert.equal(isMainStore({ slug: MAIN_STORE_SLUG, id: MAIN_STORE_ID } as any), false);
  });
});

describe('MAIN_STORE_THEME_SEED', () => {
  it('usa las claves de la COLUMNA theme, no las del payload', () => {
    // `buildTenantConfig` lee `theme.primary_color`; si la semilla usara `primary`
    // se guardaría igual (es JSON) y saldría un theme vacío, en silencio.
    assert.deepEqual(Object.keys(MAIN_STORE_THEME_SEED).sort(), [
      'accent_color',
      'primary_color',
      'secondary_color',
    ]);
  });

  it('coincide con los literales de defaultConfig.theme.colors en el storefront', () => {
    if (!existsSync(DEFAULT_TS)) return; // backend desplegado solo: nada que cruzar
    const src = readFileSync(DEFAULT_TS, 'utf8');

    // Se lee el bloque `theme:` para no capturar colores de `assets`.
    const themeBlock = /theme:\s*\{[\s\S]*?colors:\s*\{([\s\S]*?)\}/.exec(src);
    assert.ok(themeBlock, 'No pude encontrar defaultConfig.theme.colors en default.ts');
    const colors = themeBlock[1]!;

    const pick = (key: string): string | undefined =>
      new RegExp(`${key}:\\s*"([^"]+)"`).exec(colors)?.[1];

    assert.equal(
      pick('primary'),
      MAIN_STORE_THEME_SEED.primary_color,
      'defaultConfig.theme.colors.primary cambió: actualizá MAIN_STORE_THEME_SEED.'
    );
    assert.equal(
      pick('secondary'),
      MAIN_STORE_THEME_SEED.secondary_color,
      'defaultConfig.theme.colors.secondary cambió: actualizá MAIN_STORE_THEME_SEED.'
    );
    assert.equal(
      pick('accent'),
      MAIN_STORE_THEME_SEED.accent_color,
      'defaultConfig.theme.colors.accent cambió: actualizá MAIN_STORE_THEME_SEED. ' +
        'Es el color de las etiquetas de promo — perderlo es visible.'
    );
  });
});

/**
 * Contenedor mínimo para `ensureMainStore`. Sólo los cuatro `resolve` que usa; un
 * quinto tira, que es lo que hace que el test falle si la función empieza a depender
 * de algo nuevo en silencio.
 */
const fakeContainer = (opts: {
  storeName?: string | null;
  existingMain?: boolean;
  created: Record<string, unknown>[];
}) => ({
  resolve(key: string) {
    if (key === ContainerRegistrationKeys.LOGGER) {
      return { info: () => {}, warn: () => {} };
    }
    if (key === DEMO_STORE_MODULE) {
      return {
        listDemoStores: async () => (opts.existingMain ? [{ id: MAIN_STORE_ID }] : []),
        createDemoStores: async (row: Record<string, unknown>) => {
          opts.created.push(row);
          return row;
        },
      };
    }
    if (key === Modules.STORE) {
      return {
        listStores: async () => [
          { name: opts.storeName, default_sales_channel_id: 'sc_default', default_region_id: null },
        ],
      };
    }
    if (key === Modules.REGION) return { listRegions: async () => [] };
    throw new Error(`resolve inesperado: ${key}`);
  },
});

describe('ensureMainStore · nombre de la fila principal', () => {
  it('toma el nombre del Store de Medusa, no un literal del boilerplate', async () => {
    // El literal hardcodeado hacía que TODO proyecto generado naciera con su tienda
    // principal llamada "Mercatto". En el backoffice de un cliente eso se lee como
    // una DB copiada, y ya costó una ronda de diagnóstico en Desde el Sur.
    const created: Record<string, unknown>[] = [];
    await ensureMainStore(fakeContainer({ storeName: 'Desde el Sur', created }));
    assert.equal(created.length, 1);
    assert.equal(created[0]!.name, 'Desde el Sur');
  });

  it('cae al fallback cuando el Store no tiene nombre, o lo tiene en blanco', async () => {
    for (const storeName of [null, '   ']) {
      const created: Record<string, unknown>[] = [];
      await ensureMainStore(fakeContainer({ storeName, created }));
      assert.equal(created[0]!.name, MAIN_STORE_FALLBACK_NAME);
    }
  });

  it('sigue siendo idempotente: con una fila is_main no crea nada', async () => {
    const created: Record<string, unknown>[] = [];
    await ensureMainStore(fakeContainer({ storeName: 'X', existingMain: true, created }));
    assert.equal(created.length, 0);
  });
});
