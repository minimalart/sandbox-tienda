import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PostAdminCreateEmailTemplate,
  PostAdminUpdateEmailTemplate,
} from './validators';

/**
 * `site_id` tiene que SOBREVIVIR al validator.
 *
 * Parece un detalle de schema y era la mitad admin de un bug de envío. zod borra del
 * body todo lo que el schema no declara, así que un `site_id` mandado desde el admin
 * se descartaba EN SILENCIO: la ruta de alta aplicaba `siteDefaults` de la request y no
 * quedaba ninguna manera de crear una plantilla GLOBAL ni de convertir una en global.
 *
 * Y la global es la ÚNICA que los ~10 emisores sin eje pueden leer — el reseteo de
 * contraseña arriba de todo, cuyo evento (`auth.password_reset`) trae
 * `{ entity_id, token, actor_type }` y nada más. O sea: la única plantilla que el path
 * de reseteo alcanzaba era exactamente la que el admin no podía producir.
 *
 * Estos tests FALLAN con el bug: sin `site_id` en el schema, zod lo strippea y el
 * campo no aparece en el resultado.
 */

const base = {
  name: 'Reseteo de contraseña',
  subject: 'Recuperá tu contraseña',
  html: '<p>{{link_reseteo}}</p>',
};

// ── El alta ──────────────────────────────────────────────────────────────────────

test('create: un site_id explícito sobrevive al validator', () => {
  const parsed = PostAdminCreateEmailTemplate.parse({ ...base, site_id: 'demo_sur' });
  assert.equal(parsed.site_id, 'demo_sur');
});

test('create: null es GLOBAL y es un valor VÁLIDO, no un error', () => {
  // `.nullable()` es la pieza que importa. Con `.optional()` a secas, `null` sería un
  // error de validación y "global" quedaría inexpresable — que es el estado del bug.
  const parsed = PostAdminCreateEmailTemplate.parse({ ...base, site_id: null });
  assert.equal(parsed.site_id, null);
  assert.ok('site_id' in parsed, 'null tiene que llegar como null, no desaparecer');
});

test('create: el campo ausente NO es lo mismo que null', () => {
  // Ausente significa "no digo nada, aplicá siteDefaults de la request"; null significa
  // "global". Si el schema los colapsara, cada alta desde el selector de una tienda
  // crearía una plantilla global.
  const parsed = PostAdminCreateEmailTemplate.parse(base);
  assert.equal(parsed.site_id, undefined);
});

test('create: la cadena vacía se rechaza', () => {
  // `''` no es "global" ni una tienda: es un valor que pasaría el `typeof === 'string'`
  // de medio repo y no matchearía ninguna fila. Para global se manda null.
  assert.throws(() => PostAdminCreateEmailTemplate.parse({ ...base, site_id: '' }));
});

// ── La edición ───────────────────────────────────────────────────────────────────

test('update: acepta site_id y distingue null de ausente', () => {
  assert.equal(PostAdminUpdateEmailTemplate.parse({ site_id: 'demo_norte' }).site_id, 'demo_norte');
  assert.equal(PostAdminUpdateEmailTemplate.parse({ site_id: null }).site_id, null);
  assert.equal(PostAdminUpdateEmailTemplate.parse({ subject: 'x' }).site_id, undefined);
});

// ── El resto del schema sigue siendo el mismo ────────────────────────────────────

test('los campos que ya existían no cambiaron', () => {
  const parsed = PostAdminCreateEmailTemplate.parse({
    ...base,
    key: 'password-reset',
    status: 'published',
  });
  assert.equal(parsed.key, 'password-reset');
  assert.equal(parsed.status, 'published');
});

// ── Las rutas tienen que arbitrar el valor, no confiar en el schema ──────────────

const ROUTES = join(import.meta.dirname);
const CREATE_ROUTE = readFileSync(join(ROUTES, 'route.ts'), 'utf8');
const DETAIL_ROUTE = readFileSync(join(ROUTES, '[id]', 'route.ts'), 'utf8');

test('aceptar site_id sin arbitrarlo sería abrir la escritura cruzada', () => {
  // Un schema no tiene la tienda de la request en la mano. Sin este guard, un operador
  // con la tienda A abierta podría escribir la plantilla de la B mandando su id — que
  // es justo lo que `assertIdInSite` cierra por el lado del id.
  for (const [label, src] of [['alta', CREATE_ROUTE], ['edición', DETAIL_ROUTE]] as const) {
    assert.match(
      src,
      /assertWritableSiteId\(/,
      `la ruta de ${label} acepta site_id sin pasar por la política de escritura`,
    );
  }
});

test('el site_id crudo no se spreadea sobre el patch de la política', () => {
  // `...validated` después del patch pisaría el veredicto con el valor sin filtrar. Es
  // un bug de UNA línea que anula el guard entero y no rompe nada visible.
  for (const [label, src] of [['alta', CREATE_ROUTE], ['edición', DETAIL_ROUTE]] as const) {
    assert.match(
      src,
      /const \{ site_id: _rawSiteId, \.\.\.fields \} = validated;/,
      `la ruta de ${label} no separa el site_id crudo del resto del body`,
    );
    assert.match(src, /\.\.\.siteIdPatch,/, `la ruta de ${label} no aplica el patch de la política`);
  }
});
