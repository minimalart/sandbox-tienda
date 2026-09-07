import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `site_setting` existe para arreglar dos cosas concretas de `site_manager_setting`.
 * Las dos son invisibles hasta que muerden, así que se fijan acá.
 *
 * Se verifica sobre el fuente y no ejecutando: el servicio extiende `MedusaService`,
 * que necesita un container y una DB. Lo que hay que impedir es que alguien
 * "simplifique" el orden de escritura o colapse los índices, y para eso alcanza.
 */

const MODULE_DIR = import.meta.dirname;
const SERVICE = readFileSync(join(MODULE_DIR, 'service.ts'), 'utf8');
const MODEL = readFileSync(join(MODULE_DIR, 'models', 'site-setting.ts'), 'utf8');
const MIGRATION = readFileSync(
  join(MODULE_DIR, 'migrations', 'Migration20260807130000DemoStore.ts'),
  'utf8',
);

test('la revisión se crea ANTES de escribir el valor', () => {
  // Este orden es el arreglo del locking. Al revés —como hacía site-manager— dos
  // writers con el mismo expectedRevision pasan los dos el check, y el que pierde
  // choca contra el índice único DESPUÉS de haber pisado el valor.
  const body = SERVICE.slice(SERVICE.indexOf('async upsertSiteSetting'));
  const createRevision = body.indexOf('createSiteSettingRevisions');
  const writeValue = body.indexOf('updateSiteSettings');

  assert.ok(createRevision > 0, 'upsertSiteSetting ya no crea la revisión');
  assert.ok(writeValue > 0, 'upsertSiteSetting ya no escribe el valor');
  assert.ok(
    createRevision < writeValue,
    'La revisión tiene que crearse ANTES de tocar el valor: es lo que hace que el ' +
      'índice único arbitre la carrera y el writer perdedor falle sin escribir nada.',
  );
});

test('el modelo declara DOS índices únicos parciales por tabla', () => {
  // En Postgres NULL != NULL dentro de un índice único: uno solo sobre
  // (site_id, namespace) NO impide dos filas globales del mismo namespace, y con
  // dos filas globales la config efectiva sale al azar.
  const globalIdx = /where:\s*'site_id IS NULL AND deleted_at IS NULL'/g;
  const siteIdx = /where:\s*'site_id IS NOT NULL AND deleted_at IS NULL'/g;

  assert.equal((MODEL.match(globalIdx) ?? []).length, 2, 'falta el índice parcial de filas globales en alguna de las dos tablas');
  assert.equal((MODEL.match(siteIdx) ?? []).length, 2, 'falta el índice parcial por tienda en alguna de las dos tablas');
});

test('la migración crea los cuatro índices únicos parciales', () => {
  for (const idx of [
    'IDX_site_setting_global_ns',
    'IDX_site_setting_site_ns',
    'IDX_site_setting_rev_global',
    'IDX_site_setting_rev_site',
  ]) {
    assert.match(MIGRATION, new RegExp(`CREATE UNIQUE INDEX IF NOT EXISTS "${idx}"`), `falta ${idx}`);
  }
  // Sin el WHERE el índice deja de ser parcial y las filas soft-deleted bloquean
  // recrear un namespace borrado.
  assert.equal((MIGRATION.match(/WHERE "site_id" IS NULL AND "deleted_at" IS NULL/g) ?? []).length, 2);
  assert.equal((MIGRATION.match(/WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL/g) ?? []).length, 2);
});

test('la migración NO lleva FK a demo_store', () => {
  // El módulo puede no estar instalado en un proyecto de cliente, y una FK a una
  // tabla ausente haría fallar la migración entera.
  assert.doesNotMatch(MIGRATION, /REFERENCES\s+"?demo_store"?/i);
});

test('getSiteSetting NO cae al global por su cuenta', () => {
  // Mezclar "traer el valor" con "resolver precedencia" es el fail-open que
  // lib/multistore/scope.ts existe para evitar: quien quiera precedencia pide las dos
  // filas y usa pickBySitePrecedence.
  const body = SERVICE.slice(
    SERVICE.indexOf('async getSiteSetting'),
    SERVICE.indexOf('async listSiteSettingWithGlobal'),
  );
  assert.doesNotMatch(body, /site_id:\s*\[/, 'getSiteSetting está trayendo también la fila global');
});

test('seedSiteSettingsFromGlobal no pisa lo que la tienda ya definió', () => {
  const body = SERVICE.slice(SERVICE.indexOf('async seedSiteSettingsFromGlobal'));
  assert.match(body, /if \(existing\) continue;/, 'la copia inicial estaría pisando config propia de la tienda');
});
