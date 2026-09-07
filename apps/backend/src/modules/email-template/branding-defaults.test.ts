import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { withBrandingDefaults, siteIdOf } from './branding-defaults';

/**
 * La vista previa y el "Enviar prueba" tienen que renderizar con LOS MISMOS datos.
 *
 * Cuando no lo hacían, la misma plantilla se veía bien en la pantalla y llegaba sin
 * estilos al buzón: `preview` inyectaba el branding y `test-send` no. El envío de
 * prueba es el único ensayo antes de mandarle un mail a un cliente, así que una
 * divergencia ahí no es cosmética — es un ensayo que miente.
 */

const BRANDING = {
  primary_color: '#76B72D',
  text_color: '#111111',
  logo_url: 'https://cdn.example/logo.svg',
  cde_display_name: 'Desde el sur',
  admin_notification_email: null,
};

/** Un `req` con lo único que el helper le pide: resolver el módulo de store-config. */
const reqWith = (branding: unknown, calls: Array<string | null | undefined> = []) =>
  ({
    scope: {
      resolve: () => ({
        getEmailBranding: async (siteId?: string | null) => {
          calls.push(siteId);
          if (branding instanceof Error) throw branding;
          return branding;
        },
      }),
    },
  }) as never;

const SITE = { status: 'site', site: { id: 'demo_b' } } as never;

test('rellena los campos de presentación que el operador nunca escribe', async () => {
  const data = await withBrandingDefaults(reqWith(BRANDING), SITE, {});
  assert.equal(data.primary_color, '#76B72D');
  assert.equal(data.logo_url, 'https://cdn.example/logo.svg');
  assert.equal(data.cde_display_name, 'Desde el sur');
  assert.equal(data.year, new Date().getFullYear());
  assert.match(String(data.primary_color_bg), /^rgba\(/);
});

test('`sales_channel_name` se rellena: es la que dejaba los asuntos en `[]`', async () => {
  // Encabeza el subject de media docena de plantillas y no la manda ningún emisor.
  // Sin esto la pantalla seguiría mostrando `[] Restablecer tu contraseña` DESPUÉS
  // de que el mail real ya sale bien — el operador ve un bug que ya no existe.
  const data = await withBrandingDefaults(reqWith(BRANDING), SITE, {});
  assert.equal(data.sales_channel_name, 'Desde el sur');
});

test('lo que manda el emisor GANA: son defaults, no override', async () => {
  // Si esto se invirtiera, la vista previa mostraría el branding de la tienda encima
  // de los valores reales y dejaría de servir para comparar.
  const data = await withBrandingDefaults(reqWith(BRANDING), SITE, {
    primary_color: '#ff0000',
    sales_channel_name: 'Canal Mayorista',
  });
  assert.equal(data.primary_color, '#ff0000');
  assert.equal(data.sales_channel_name, 'Canal Mayorista');
});

test('la cadena vacía cuenta como AUSENTE, no como valor', async () => {
  // El `sample_data` del seed viaja con `logo_url: ''`. Con un `??=` pasaría el filtro
  // y el mail de prueba saldría sin logo.
  const data = await withBrandingDefaults(reqWith(BRANDING), SITE, { logo_url: '' });
  assert.equal(data.logo_url, 'https://cdn.example/logo.svg');
});

test('`primary_color_bg` se deriva del color del EMISOR si vino uno', async () => {
  const data = await withBrandingDefaults(reqWith(BRANDING), SITE, { primary_color: '#000000' });
  assert.equal(data.primary_color_bg, 'rgba(0,0,0,0.1)');
});

test('lee el branding de LA TIENDA, no el global', async () => {
  // `getEmailBranding()` sin argumento devuelve el global, y así lo llamaba la vista
  // previa: el operador de la tienda B veía el logo de la instancia.
  const calls: Array<string | null | undefined> = [];
  await withBrandingDefaults(reqWith(BRANDING, calls), SITE, {});
  assert.deepEqual(calls, ['demo_b']);
});

test('sin tienda resuelta pide el global, y no rompe', async () => {
  const calls: Array<string | null | undefined> = [];
  await withBrandingDefaults(reqWith(BRANDING, calls), { status: 'allSites' } as never, {});
  assert.deepEqual(calls, [null]);
});

test('un branding ilegible NO tumba la pantalla', async () => {
  // Best-effort igual que el provider, que jamás bloquea un mail por el branding.
  const data = await withBrandingDefaults(reqWith(new Error('boom')), SITE, { message: 'hola' });
  assert.equal(data.message, 'hola');
  assert.equal(data.primary_color, undefined);
});

test('no muta el objeto que recibe', async () => {
  const original: Record<string, unknown> = {};
  await withBrandingDefaults(reqWith(BRANDING), SITE, original);
  assert.deepEqual(original, {}, 'mutar la entrada haría que el caller mande datos que no eligió');
});

test('`siteIdOf` trata `singleSite` como tienda', () => {
  // Con una sola tienda, "de qué tienda es este branding" no tiene otra respuesta.
  assert.equal(siteIdOf({ status: 'singleSite', site: { id: 'demo_main' } } as never), 'demo_main');
  assert.equal(siteIdOf({ status: 'registryAbsent', reason: 'module' } as never), null);
});

/**
 * El guard estructural: que las dos rutas no puedan volver a divergir.
 *
 * Los tests de arriba prueban que el helper hace lo correcto; estos prueban que las
 * dos rutas lo USAN. Sin esto, alguien vuelve a inyectar branding a mano en una sola
 * y el bug reaparece idéntico.
 */
const ROUTES = join(import.meta.dirname, '..', '..', 'api', 'admin', 'email-templates', '[id]');
const PREVIEW = readFileSync(join(ROUTES, 'preview', 'route.ts'), 'utf8');
const TEST_SEND = readFileSync(join(ROUTES, 'test-send', 'route.ts'), 'utf8');

for (const [label, src] of [['preview', PREVIEW], ['test-send', TEST_SEND]] as const) {
  test(`${label} usa el helper compartido`, () => {
    assert.match(src, /withBrandingDefaults\(/);
    // Se afirma sobre el IMPORT y no sobre `getEmailBranding(`: la primera versión
    // de este test miraba el nombre de la función y la prosa de un comentario que
    // explicaba el bug lo hacía fallar. Un guard que se dispara con la
    // documentación del bug que previene se termina borrando.
    assert.doesNotMatch(
      src,
      /^import .*store-config/m,
      'volvió a leer el branding a mano: las dos rutas pueden divergir otra vez',
    );
  });
}

test('test-send inyecta el branding ANTES de renderizar', () => {
  // Es el orden lo que importa, y es lo que estaba mal. `__inline__` le pide al
  // provider que no toque el contenido, así que después de `renderEmailTemplate`
  // ya no hay dónde meter el logo ni los colores.
  const inject = TEST_SEND.indexOf('withBrandingDefaults(');
  const render = TEST_SEND.indexOf('renderEmailTemplate({');
  const notify = TEST_SEND.indexOf('createNotifications(');
  assert.ok(inject > -1 && render > -1 && notify > -1);
  assert.ok(inject > render, 'la inyección tiene que estar DENTRO del render, no después');
  assert.ok(render < notify, 'se renderiza antes de notificar');
});
