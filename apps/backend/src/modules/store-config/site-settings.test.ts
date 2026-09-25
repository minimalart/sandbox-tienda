import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La configuración de `store_setting` pasa a resolverse por tienda, con la fila
 * `site_id NULL` como GLOBAL — el fallback de toda tienda que no defina el suyo.
 *
 * Es precedencia, no unión, y ahí está la trampa: traer las dos filas y quedarse con
 * `rows[0]` da un resultado que depende del plan de ejecución. A veces el de la
 * tienda, a veces el global. Es el mismo fail-open que el seam evita separando
 * `siteFilter` de `pickBySitePrecedence`.
 */

const SERVICE = readFileSync(join(import.meta.dirname, 'service.ts'), 'utf8');
const MODEL = readFileSync(join(import.meta.dirname, 'models', 'store-setting.ts'), 'utf8');

test('la lectura consulta la tienda primero y el global después', () => {
  const body = SERVICE.slice(SERVICE.indexOf('async readSetting'));
  const own = body.indexOf('site_id: siteId');
  const global = body.indexOf('site_id: null');
  assert.ok(own > -1, 'no consulta la fila de la tienda');
  assert.ok(global > own, 'consulta el global antes que la tienda: ninguna tendría config propia');
});

test('escribir sin tienda toca la fila GLOBAL, no la de cualquiera', () => {
  // Es lo que hace que el deploy no cambie nada: una instalación mono-tienda y toda
  // pantalla que aún no manda la tienda activa siguen escribiendo donde escribían.
  const body = SERVICE.slice(SERVICE.indexOf('async upsertSetting'));
  assert.match(body, /const site_id = siteId \?\? null;/);
  assert.match(body, /listStoreSettings\(\{ key, site_id \}\)/);
  assert.match(body, /createStoreSettings\(\{ key, site_id/);
});

test('el upsert lee y escribe la MISMA fila', () => {
  // Si leyera con precedencia y escribiera con la tienda, editar la config de una
  // tienda sin fila propia crearía una copia del global — y a partir de ahí los
  // cambios al global dejarían de propagarse, en silencio.
  const body = SERVICE.slice(
    SERVICE.indexOf('async upsertSetting'),
    SERVICE.indexOf('async upsertSetting') + 600,
  );
  assert.doesNotMatch(body, /readSetting/, 'el upsert no puede resolver por precedencia');
});

test('DOS índices únicos parciales, no uno', () => {
  // En Postgres `NULL != NULL`: un único UNIQUE (site_id, key) NO impide dos filas
  // globales con la misma clave. Con dos, la config "se revierte sola" cada tanto.
  assert.match(MODEL, /where: 'site_id IS NULL AND deleted_at IS NULL'/);
  assert.match(MODEL, /where: 'site_id IS NOT NULL AND deleted_at IS NULL'/);
});

test('ningún módulo lee store_setting por listStoreSettings a secas', () => {
  // Regresión que introdujo la propia columna `site_id`: `listStoreSettings({ key })`
  // ahora puede devolver DOS filas —la de la tienda y la global— y quedarse con
  // `rows[0]` da un resultado que depende del plan de ejecución. A veces la config de
  // la tienda, a veces la global, sin nada que avise.
  //
  // Este test camina los módulos que leen config y exige que pasen por `readSetting`.
  // `api/` incluido: las rutas también leen config, y dejarlas afuera fue justamente
  // cómo se me escaparon `kapso/bindings` y su detalle en la primera pasada.
  const src = join(import.meta.dirname, '..', '..');
  const roots = [join(src, 'modules'), join(src, 'lib'), join(src, 'api')];
  const offenders: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
        continue;
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
      // El propio service es quien implementa la lectura correcta.
      if (full.endsWith(join('store-config', 'service.ts'))) continue;
      // El interruptor de emergencia agrega apagados globales/de tienda en vez de
      // resolver una fila por precedencia. bot-switch.test.ts cubre ese contrato.
      if (full.endsWith(join('kapso-whatsapp', 'bot-switch.ts'))) continue;
      // Se sacan los comentarios antes de buscar: si no, la propia nota que explica
      // por qué NO hay que usarlo cuenta como infracción.
      const src = readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      if (/listStoreSettings\(\s*\{\s*key/.test(src)) offenders.push(full.split('/src/')[1] ?? full);
    }
  };
  for (const root of roots) walk(root);

  assert.deepEqual(
    offenders,
    [],
    `Estos leen store_setting sin precedencia de tienda; usá readSetting(key, siteId):\n  ${offenders.join('\n  ')}`,
  );
});
