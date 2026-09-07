import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pickTemplate, type PublishedTemplateRow } from './db-template-pick';

/**
 * Una plantilla PUBLICADA y scopeada a una tienda tiene que reemplazar al template del
 * código. Cuando no lo hace, no hay error, no hay log, y el operador reporta "edité la
 * plantilla, la publiqué, y sigue saliendo la de antes".
 *
 * EL BUG QUE ESTE ARCHIVO CIERRA. El SQL de `loadDbTemplate` filtraba con
 * `("site_id" = ? OR "site_id" IS NULL)`. Con la tienda en `null` —los ~10 emisores
 * cuyo evento no lleva ningún eje: reseteo de contraseña, alta de cliente, invitación
 * de admin— `"site_id" = NULL` no matchea nada, porque en Postgres `x = NULL` no es
 * falso sino NULL. Sólo entraban las filas GLOBALES. Y `site_id` no estaba en los
 * validators del admin, así que la plantilla global era literalmente la única que el
 * path de reseteo podía leer Y la única que el admin no podía producir.
 *
 * Se prueba en dos capas porque `service.ts` no se puede importar (arrastra
 * `@medusajs/framework` y `@sendgrid/mail`): la REGLA con casos sobre `pickTemplate`,
 * y el SQL y la resolución de tienda sobre el fuente, igual que `site-branding.test.ts`.
 */

const row = (site_id: string | null, subject: string): PublishedTemplateRow => ({
  subject,
  html: `<p>${subject}</p>`,
  site_id,
});

// ── La regla: qué plantilla sale ─────────────────────────────────────────────────

test('la plantilla de la tienda le gana a la global', () => {
  const picked = pickTemplate([row('demo_sur', 'del sur'), row(null, 'global')], 'demo_sur');
  assert.equal(picked.status, 'template');
  assert.equal(picked.status === 'template' && picked.subject, 'del sur');
  assert.equal(picked.status === 'template' && picked.from, 'site');
});

test('sin plantilla propia, la tienda hereda la global', () => {
  const picked = pickTemplate([row(null, 'global'), row('demo_norte', 'del norte')], 'demo_sur');
  assert.equal(picked.status, 'template');
  assert.equal(picked.status === 'template' && picked.subject, 'global');
  assert.equal(picked.status === 'template' && picked.from, 'global');
});

test('sin filas publicadas no hay plantilla y no hay que avisar nada', () => {
  // Es la configuración NORMAL: la mayoría de las claves sólo existen en el código.
  assert.deepEqual(pickTemplate([], 'demo_sur'), { status: 'none' });
  assert.deepEqual(pickTemplate([], null), { status: 'none' });
});

test('la plantilla de OTRA tienda no se usa jamás', () => {
  // El modo de falla más caro del módulo es un mail con la marca de otra tienda, y no
  // se puede deshacer: el mail ya salió.
  const picked = pickTemplate([row('demo_norte', 'del norte')], 'demo_sur');
  assert.notEqual(picked.status, 'template');
});

// ── El caso del bug: mail SIN tienda ────────────────────────────────────────────

test('un mail sin tienda alcanza la plantilla GLOBAL', () => {
  // Es lo único que puede alcanzar, y es exactamente por eso que el admin tiene que
  // poder crear una global. Ver `validators.test.ts`.
  const picked = pickTemplate([row('demo_main', 'de la principal'), row(null, 'global')], null);
  assert.equal(picked.status, 'template');
  assert.equal(picked.status === 'template' && picked.subject, 'global');
});

test('un mail sin tienda NO adopta la plantilla de una tienda cualquiera', () => {
  // La tentación es "hay una sola fila publicada, usá esa". Con varias tiendas eso le
  // manda al cliente de la B un mail con la marca de la A. No se adivina acá: la
  // tienda implícita se resuelve en `implicitSiteId` y SÓLO con una tienda.
  const picked = pickTemplate([row('demo_norte', 'del norte'), row('demo_sur', 'del sur')], null);
  assert.notEqual(picked.status, 'template');
});

// ── El rastro: lo que antes era indistinguible de "no hay plantilla" ─────────────

test('filas publicadas y ninguna alcanzable se REPORTA, no se confunde con "no hay"', () => {
  // Es la diferencia entre cinco minutos y una tarde. Sin este estado el provider
  // devolvía el mismo `null` que cuando la clave no existe en la base, y el log queda
  // vacío en el único caso donde alguien SÍ configuró algo.
  const picked = pickTemplate([row('demo_main', 'de la principal')], null);
  assert.equal(picked.status, 'outOfScope');
  assert.deepEqual(picked.status === 'outOfScope' && picked.siteIds, ['demo_main']);
});

test('el reporte nombra las tiendas, sin repetir y sin el null', () => {
  const picked = pickTemplate(
    [row('demo_norte', 'a'), row('demo_sur', 'b'), row('demo_norte', 'c')],
    'demo_centro',
  );
  assert.equal(picked.status, 'outOfScope');
  assert.deepEqual(picked.status === 'outOfScope' && picked.siteIds, ['demo_norte', 'demo_sur']);
});

test('si existe la global, no hay nada que reportar', () => {
  // La global es un fallback válido: heredarla NO es una falla de configuración.
  const picked = pickTemplate([row('demo_norte', 'a'), row(null, 'global')], 'demo_sur');
  assert.equal(picked.status, 'template');
});

// ── El SQL y la tienda del mail, sobre el fuente ─────────────────────────────────

const SERVICE = readFileSync(join(import.meta.dirname, 'service.ts'), 'utf8');

/**
 * Los comentarios NO cuentan.
 *
 * Media docena de estas aserciones son "esta forma no puede volver", y los comentarios
 * de este módulo CITAN las formas viejas para explicar por qué se fueron. Sin este
 * filtro, el propio comentario que documenta el bug hace fallar el test que lo
 * previene — y el arreglo obvio (borrar el comentario) es exactamente el peor.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\n'"`]*\/\/.*$/gm, '');

const CODE = stripComments(SERVICE);

const loadDbTemplateBody = () => {
  const start = CODE.indexOf('private async loadDbTemplate');
  const end = CODE.indexOf('private warnTemplateOutOfScope');
  assert.ok(start > -1 && end > start, 'no se encontró el cuerpo de loadDbTemplate');
  return CODE.slice(start, end);
};

test('el SQL de la plantilla NO filtra por tienda en el WHERE', () => {
  // ESTE es el test que falla con el bug. `("site_id" = ? OR "site_id" IS NULL)` deja
  // afuera toda fila de tienda cuando el binding es NULL, y esa es la forma exacta que
  // no puede volver.
  const body = loadDbTemplateBody();
  assert.doesNotMatch(
    body,
    /"site_id" = \?/,
    'volvió el filtro por tienda en el WHERE: con siteId NULL deja afuera TODA fila de tienda',
  );
  assert.match(body, /pickTemplate\(rows, siteId\)/, 'la precedencia tiene que decidirla pickTemplate');
});

test('el ORDER BY garantiza que el LIMIT no pueda recortar la respuesta', () => {
  // El límite existe para no traer una fila por tienda en una instancia grande. Es
  // seguro SÓLO porque las dos filas que pueden ganar —la de la tienda y la global—
  // ordenan primero. Sin el CASE, el LIMIT podría dejar afuera la que corresponde.
  const body = loadDbTemplateBody();
  assert.match(body, /WHEN "site_id" IS NOT DISTINCT FROM \?::text THEN 0/);
  assert.match(body, /WHEN "site_id" IS NULL THEN 1/);
  assert.match(body, /ELSE 2/);
  assert.match(body, /LIMIT \d+/);
});

test('el warn no cuesta una query extra', () => {
  // Es el camino caliente de cada mail que sale. La fila fuera de scope viene en la
  // MISMA consulta: si alguien agrega un segundo `pgConnection.raw` acá, el
  // diagnóstico deja de ser gratis.
  const body = loadDbTemplateBody();
  const queries = body.match(/this\.pgConnection\.raw\(/g) ?? [];
  assert.equal(queries.length, 1, `loadDbTemplate hace ${queries.length} queries, tiene que hacer 1`);
});

test('el caso fuera de scope se loguea', () => {
  const body = loadDbTemplateBody();
  assert.match(body, /picked\.status === 'outOfScope'/);
  assert.match(body, /this\.warnTemplateOutOfScope\(/);
  const warn = CODE.slice(CODE.indexOf('private warnTemplateOutOfScope'));
  assert.match(warn, /this\.logger\.warn\(/);
});

// ── La tienda implícita: el fallback, y su límite ────────────────────────────────

const implicitBody = () => {
  const start = CODE.indexOf('private async implicitSiteId');
  assert.ok(start > -1, 'no existe implicitSiteId: el mail sin eje no alcanza su plantilla');
  return CODE.slice(start);
};

test('sin eje en la data, la tienda se hereda sólo si hay UNA', () => {
  const body = implicitBody();
  assert.match(body, /resolveSiteViaSql\(this\.pgConnection, \{\}\)/, 'tiene que preguntar con hint vacío');
  assert.match(body, /status === 'singleSite'/, 'sólo `singleSite` puede heredarse');
});

test('el fallback NUNCA cae a la tienda principal', () => {
  // Es la línea que no se puede cruzar. Con varias tiendas, elegir la `is_main` le
  // manda al cliente de la B un mail con la marca, el remitente y los links de la A —
  // y el mail ya salió. `job-scope.ts` describe este mismo riesgo para el reseteo.
  assert.doesNotMatch(
    CODE,
    /allowMainFallback/,
    'el provider de email no puede caer a la tienda principal: mandaría la marca de otra tienda',
  );
});

test('la tienda implícita está cacheada, incluido el null', () => {
  // El `null` de una instalación multitienda es el valor que MÁS se consulta —cada mail
  // sin eje— y no puede costar una query por mail.
  const body = implicitBody();
  assert.match(body, /this\.implicitSiteCache/);
  assert.match(body, /this\.implicitSiteCache = \{ value, at: now \}/);
});

test('siteIdForNotification cae al implícito y no a null', () => {
  const start = SERVICE.indexOf('private async siteIdForNotification');
  const end = SERVICE.indexOf('private async implicitSiteId');
  const body = SERVICE.slice(start, end);
  assert.match(
    body,
    /return this\.implicitSiteId\(\);/,
    'sin site_id ni sales_channel_id tiene que caer al implícito: devolver null es el bug',
  );
});
