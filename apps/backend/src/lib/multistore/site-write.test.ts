import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideSiteIdWrite } from './site-write';
import type { SiteRef, SiteResolution } from './types';

/**
 * Quién puede escribir QUÉ `site_id`.
 *
 * El seam ya tenía las dos mitades de la LECTURA (`siteFilter`) y del acceso por id
 * (`assertIdInSite`). Faltaba esta: cuando el body trae `site_id`, ese campo no es un
 * dato más — es la MUDANZA de la fila entre tiendas, y decide a quiénes les cambia el
 * contenido.
 *
 * Hasta ahora el problema no existía porque ningún validator aceptaba el campo y zod lo
 * borraba. El costo de eso era que desde el admin NO había forma de crear ni de
 * convertir una plantilla de email en GLOBAL — y la global es la única que los emisores
 * sin eje (reseteo de contraseña, alta de cliente) pueden leer.
 */

const site = (id: string, is_main = false): SiteRef => ({
  id,
  slug: id.replace('demo_', ''),
  name: id,
  is_main,
  channel_ids: [`sc_${id}`],
  region_id: null,
  stock_location_id: null,
});

const ACTIVE: SiteResolution = { status: 'site', site: site('demo_sur') };
const ALL: SiteResolution = { status: 'allSites' };
const SINGLE: SiteResolution = { status: 'singleSite', site: site('demo_main', true) };
const ABSENT: SiteResolution = { status: 'registryAbsent', reason: 'table' };
const UNKNOWN: SiteResolution = { status: 'unknownSite', hint: { siteId: 'demo_borrada' } };

const ask = (
  resolution: SiteResolution,
  requested: string | null | undefined,
  current?: string | null,
) => decideSiteIdWrite(resolution, { column: 'site_id', requested, current });

// ── El campo ausente no toca nada ───────────────────────────────────────────────

test('sin site_id en el body no se toca el eje', () => {
  // Es la diferencia entre `.optional()` y `.nullable()`: ausente no es global.
  for (const resolution of [ACTIVE, ALL, SINGLE, ABSENT]) {
    assert.deepEqual(ask(resolution, undefined), { ok: true, patch: {} });
  }
});

// ── Sin tienda activa: libre ────────────────────────────────────────────────────

test('desde "Todas las tiendas" se puede convertir en GLOBAL', () => {
  // ESTE es el que destraba el caso real: con el selector en todas, poner site_id null
  // en la plantilla de `password-reset` la vuelve global y recién ahí el subscriber del
  // reseteo —que no puede declarar tienda— la alcanza.
  assert.deepEqual(ask(ALL, null), { ok: true, patch: { site_id: null } });
});

test('desde "Todas las tiendas" se puede asignar cualquier tienda', () => {
  assert.deepEqual(ask(ALL, 'demo_norte'), { ok: true, patch: { site_id: 'demo_norte' } });
});

test('una instalación mono-tienda o sin registro también es libre', () => {
  // Fail-open, el mismo criterio que el resto del seam: con una sola tienda no hay a
  // quién cruzarle nada.
  assert.deepEqual(ask(SINGLE, null), { ok: true, patch: { site_id: null } });
  assert.deepEqual(ask(ABSENT, 'demo_x'), { ok: true, patch: { site_id: 'demo_x' } });
});

// ── Con tienda activa: sólo esa tienda ──────────────────────────────────────────

test('asignar la fila a la tienda activa se permite', () => {
  assert.deepEqual(ask(ACTIVE, 'demo_sur', 'demo_sur'), { ok: true, patch: {} });
});

test('crear con la tienda activa se permite', () => {
  assert.deepEqual(ask(ACTIVE, 'demo_sur'), { ok: true, patch: { site_id: 'demo_sur' } });
});

test('escribir la fila de OTRA tienda se rechaza', () => {
  // Es la misma escritura cruzada que `assertIdInSite` cierra por el lado del id: sin
  // esto, aceptar `site_id` en el body sería abrir por el body lo que la ruta ya cierra.
  const verdict = ask(ACTIVE, 'demo_norte');
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.code, 'cross-site');
});

test('convertir en GLOBAL desde la pantalla de una tienda se rechaza', () => {
  // Le cambiaría el contenido a TODAS las tiendas sin fila propia, y el operador de la
  // tienda activa no tiene forma de ver a cuáles. Es el riesgo que los comentarios de
  // las rutas de email-templates ya nombran.
  const verdict = ask(ACTIVE, null, 'demo_sur');
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.code, 'globalize');
});

test('adueñarse de la fila GLOBAL desde una tienda se rechaza', () => {
  // La más traicionera: parece "me quedo con la global", y lo que hace es SACÁRSELA a
  // todas las demás, que vuelven al texto del código sin ninguna señal.
  const verdict = ask(ACTIVE, 'demo_sur', null);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.code, 'adopt-global');
});

test('el rechazo explica el efecto, no dice sólo "no permitido"', () => {
  // El operador tiene que poder actuar sobre el mensaje: el que no entiende por qué
  // rebota es el que vuelve a intentarlo por otra vía.
  const verdict = ask(ACTIVE, null, 'demo_sur');
  assert.equal(verdict.ok, false);
  assert.match(verdict.ok === false ? verdict.message : '', /Todas las tiendas/);
});

// ── No-op: un formulario que reenvía el objeto completo ─────────────────────────

test('reenviar el site_id que la fila ya tiene no rebota', () => {
  // Cualquier formulario que mande el objeto completo hace esto en cada guardado. Si
  // rebotara, la pantalla quedaría inservible para la tienda activa.
  assert.deepEqual(ask(ACTIVE, 'demo_sur', 'demo_sur'), { ok: true, patch: {} });
  assert.deepEqual(ask(ACTIVE, null, null), { ok: true, patch: {} });
});

// ── unknownSite rompe, no degrada ───────────────────────────────────────────────

test('una tienda activa inexistente no degrada a "sin tienda"', () => {
  // Colapsar un id stale en "sin tienda" es cómo una escritura termina siendo global
  // creyendo estar scopeada. Es la misma regla que `assertResolved` en `scope.ts`.
  const verdict = ask(UNKNOWN, null);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false && verdict.code, 'unknown-site');
});

test('unknownSite rompe incluso si el body no trae el campo', () => {
  // El chequeo va ANTES del atajo de `undefined`: si la request declara una tienda que
  // no existe, no hay escritura válida en esa request.
  const verdict = ask(UNKNOWN, undefined);
  assert.equal(verdict.ok, false);
});

// ── La columna no está hardcodeada ─────────────────────────────────────────────

test('el patch usa la columna del descriptor', () => {
  const verdict = decideSiteIdWrite(ALL, { column: 'owner_site_id', requested: 'demo_x' });
  assert.deepEqual(verdict, { ok: true, patch: { owner_site_id: 'demo_x' } });
});
