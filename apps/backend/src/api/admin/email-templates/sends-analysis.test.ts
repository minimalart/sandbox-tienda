import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GetAdminEmailTemplateSends,
  SENDS_DEFAULT_LIMIT,
  SENDS_MAX_LIMIT,
  analyzeSend,
  maskVariableValue,
  siteAttribution,
  truncateSecret,
  variableState,
} from './sends-analysis';
import { variablesForKey } from '../../../modules/email/template-variables';

/**
 * Los fixtures NO son inventados: son las claves EXACTAS que tienen los payloads de
 * `notification.data` en la base de desdeelsur, medidas el 02/09 con
 * `jsonb_object_keys`. Es lo que le da sentido al test: si el análisis diera bien
 * contra un payload de fantasía y mal contra el real, no habría arreglado nada.
 */

/** Las 8 claves reales de los 8 envíos de `password-reset`. Sin `subject` ni `sales_channel_name`. */
const PASSWORD_RESET_DATA = {
  cde_display_name: 'Desde el sur',
  customer_email: 'camila.cordara@minimalart.co',
  link_reseteo:
    'https://desdeelsur.minimalart.studio/reset-password?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY3Rvcl9pZCI6ImN1c19YWFgifQ.ZmFrZXNpZ25hdHVyZQ',
  logo_url:
    'https://desdeelsur.nyc3.digitaloceanspaces.com/logo-color-01M11RP7VA4MZGDVQJGHSX1AK6.svg',
  primary_color: '#1a1a1a',
  primary_color_bg: 'rgba(26,26,26,0.1)',
  text_color: '#333333',
  year: 2026,
};

const passwordResetSend = {
  id: 'noti_01M1CFG1NBGYJ2NK6PTNFK89ZA',
  to: 'camila.cordara@minimalart.co',
  created_at: new Date('2026-08-31T17:57:24.780Z'),
  status: 'success',
  provider_id: 'email-provider',
  data: PASSWORD_RESET_DATA,
};

// ─── El bug que motivó la feature ─────────────────────────────────────────────

test('el envío REAL de password-reset delata las dos variables que nadie manda', () => {
  /**
   * Este es EL caso. El catálogo declara 7 variables para `password-reset`; el
   * payload real trae 8 claves, y dos de las declaradas no están: `subject` y
   * `sales_channel_name`. Esa segunda es la que hizo que los asuntos salieran como
   * `[] Restablecer tu contraseña` durante semanas.
   *
   * El test se apoya en `variablesForKey` y no en una lista clavada acá: si mañana
   * alguien declara una variable más, este test tiene que hablar del catálogo real,
   * no de una copia que se desincroniza en silencio.
   */
  const declared = variablesForKey('password-reset');
  const analysis = analyzeSend(passwordResetSend, declared);

  const missing = analysis.variables
    .filter((v) => v.state === 'missing')
    .map((v) => v.name)
    .sort();

  assert.deepEqual(
    missing,
    ['sales_channel_name', 'subject'],
    'el análisis dejó de ver las dos variables que el emisor real nunca pobló',
  );
  assert.equal(analysis.counts.missing, 2);
  assert.equal(analysis.counts.empty, 0, 'ninguna vino vacía: vinieron AUSENTES');
});

test('las claves que nadie declaró se reportan como undeclared', () => {
  const analysis = analyzeSend(passwordResetSend, variablesForKey('password-reset'));
  const undeclared = analysis.undeclared.map((v) => v.name).sort();

  // `customer_email`, `primary_color_bg` y `text_color` viajan en el payload real y
  // el catálogo de `password-reset` no las menciona. Descubrirlas es la mitad útil
  // de la lista: son variables que EXISTEN y no están documentadas.
  assert.deepEqual(undeclared, ['customer_email', 'primary_color_bg', 'text_color']);
  assert.equal(analysis.counts.undeclared, 3);
});

test('una variable missing NO trae value: no puede confundirse con una empty', () => {
  const analysis = analyzeSend(passwordResetSend, variablesForKey('password-reset'));
  const scn = analysis.variables.find((v) => v.name === 'sales_channel_name');
  assert.ok(scn);
  assert.equal(scn.state, 'missing');
  assert.equal(scn.value, undefined);
});

// ─── Enmascarado de tokens ────────────────────────────────────────────────────

test('el token de reseteo se trunca pero la URL sigue siendo diagnosticable', () => {
  const analysis = analyzeSend(passwordResetSend, variablesForKey('password-reset'));
  const link = analysis.variables.find((v) => v.name === 'link_reseteo');
  assert.ok(link);
  assert.equal(link.state, 'ok');
  assert.equal(link.masked, true, 'sin la bandera, el operador cree que el token está roto');

  const value = String(link.value);

  // Lo que se conserva: host y path, que es lo que el operador vino a verificar.
  assert.ok(
    value.startsWith('https://desdeelsur.minimalart.studio/reset-password?token='),
    `se perdió el contexto de la URL: ${value}`,
  );
  // Lo que NO se conserva: el JWT completo. Un token vivo en el admin es una
  // escalada de privilegios.
  assert.ok(
    !value.includes(PASSWORD_RESET_DATA.link_reseteo.split('token=')[1]!),
    'el token viajó entero al cliente',
  );
  assert.match(value, /car\. ocultos\]$/);
});

test('el logo_url NO se enmascara: no es una credencial', () => {
  const analysis = analyzeSend(passwordResetSend, variablesForKey('password-reset'));
  const logo = analysis.variables.find((v) => v.name === 'logo_url');
  assert.ok(logo);
  assert.equal(logo.masked, false);
  assert.equal(logo.value, PASSWORD_RESET_DATA.logo_url);
});

test('el enmascarado también entra por el NOMBRE de la variable, sin query string', () => {
  const bare = maskVariableValue('reset_token', 'abcdefghijklmnopqrstuvwxyz');
  assert.equal(bare.masked, true);
  assert.equal(bare.value, truncateSecret('abcdefghijklmnopqrstuvwxyz'));

  // Y NO por parecido casual: `text_color` contiene "t...", `token` no está.
  assert.equal(maskVariableValue('text_color', '#333333').masked, false);
  assert.equal(maskVariableValue('primary_color', '#1a1a1a').masked, false);
  assert.equal(maskVariableValue('cde_display_name', 'Desde el sur').masked, false);
});

test('el enmascarado baja a los objetos anidados', () => {
  const nested = maskVariableValue('payload', {
    items: [{ title: 'Latex 20L', callback: 'https://x.test/cb?access_token=SUPERSECRETVALUE' }],
  });
  assert.equal(nested.masked, true);
  assert.ok(!JSON.stringify(nested.value).includes('SUPERSECRETVALUE'));
});

test('un secreto corto se tapa entero en vez de filtrar el prefijo', () => {
  assert.equal(truncateSecret('abc'), '••••');
  assert.equal(truncateSecret('12345678'), '••••');
});

// ─── ok / empty / missing ─────────────────────────────────────────────────────

test('0 y false son ok, no empty', () => {
  // Un `!value` los daría por vacíos y la pantalla mentiría con `display_id: 0`,
  // que es la familia de bugs del mail con `quantity 0`.
  assert.equal(variableState({ display_id: 0 }, 'display_id'), 'ok');
  assert.equal(variableState({ makes_free: false }, 'makes_free'), 'ok');
});

test('cadena vacía, whitespace, null, array vacío y objeto vacío son empty', () => {
  assert.equal(variableState({ a: '' }, 'a'), 'empty');
  assert.equal(variableState({ a: '   ' }, 'a'), 'empty');
  assert.equal(variableState({ a: null }, 'a'), 'empty');
  // `order_items: []` es un mail de confirmación sin productos: bug caro y el único
  // lugar donde se ve es esta pantalla.
  assert.equal(variableState({ order_items: [] }, 'order_items'), 'empty');
  assert.equal(variableState({ a: {} }, 'a'), 'empty');
});

test('la clave ausente es missing, y el payload nulo también', () => {
  assert.equal(variableState({}, 'a'), 'missing');
  assert.equal(variableState(null, 'a'), 'missing');
  assert.equal(variableState(undefined, 'a'), 'missing');
});

test('una clave heredada del prototipo no cuenta como presente', () => {
  // `'toString' in data` daría true por la cadena de prototipos y una variable
  // llamada así se reportaría `ok` con el código de una función.
  assert.equal(variableState({}, 'toString'), 'missing');
  assert.equal(variableState({}, 'constructor'), 'missing');
});

// ─── order-confirmation: el payload real más grande ───────────────────────────

test('order-confirmation real: las 14 declaradas están y sobran 11 sin declarar', () => {
  /**
   * Claves reales de los 8 `order-confirmation` de desdeelsur. Los valores están
   * simplificados; las CLAVES son las de la base, que es lo que el análisis mira.
   */
  const data: Record<string, unknown> = {
    billing_address: { city: 'Junín de los Andes' },
    cde_display_name: 'Desde el sur',
    customer_email: 'cliente@test.com',
    customer_name: 'Cliente',
    customer_phone: '2972000000',
    discounts: [],
    discount_total_formatted: '$ 0',
    display_id: 41,
    logo_url: 'https://x.test/logo.svg',
    order_date_formatted: '31/08/2026',
    order_id: 'order_01X',
    order_items: [{ title: 'Latex 20L', quantity: 1 }],
    primary_color: '#1a1a1a',
    primary_color_bg: 'rgba(26,26,26,0.1)',
    recipient_type: 'customer',
    sales_channel_id: 'sc_01X',
    shipping_address: { city: 'Junín de los Andes' },
    shipping_address_one_line: 'Calle 1, Junín de los Andes',
    shipping_display: 'Gratis',
    shipping_formatted: '$ 0',
    shipping_method_name: 'Retiro en tienda',
    subtotal_formatted: '$ 100.000',
    text_color: '#333333',
    total: '$ 100.000',
    year: 2026,
  };

  const declared = variablesForKey('order-confirmation');
  const analysis = analyzeSend(
    {
      id: 'noti_oc',
      to: 'cliente@test.com',
      created_at: '2026-08-31T17:00:00.000Z',
      status: 'success',
      provider_id: 'email-provider',
      data,
    },
    declared,
  );

  assert.equal(analysis.counts.missing, 0, 'el emisor real cubre todas las declaradas');
  // `discounts: []` es la única vacía: un pedido sin descuentos. Es correcto que se
  // marque — la pantalla informa, no juzga.
  assert.equal(analysis.counts.empty, 1);
  assert.equal(
    analysis.variables.find((v) => v.name === 'discounts')?.state,
    'empty',
  );
  assert.equal(analysis.counts.ok, declared.length - 1);

  /**
   * La lista completa, no el número. Once claves que el mail de confirmación YA
   * lleva y el catálogo no documenta: entre ellas `customer_email`, `order_id` y
   * `recipient_type`, o sea datos que una plantilla podría usar hoy mismo y que
   * nadie sabe que están disponibles. Descubrirlas es la mitad útil de la sección.
   *
   * Afirmar la lista y no el `length` es a propósito: con el número, declarar una de
   * estas en el catálogo dejaría el test en rojo sin decir cuál se movió.
   */
  assert.deepEqual(analysis.undeclared.map((v) => v.name).sort(), [
    'billing_address',
    'customer_email',
    'customer_name',
    'customer_phone',
    'discount_total_formatted',
    'order_id',
    'recipient_type',
    'sales_channel_id',
    'shipping_address',
    'shipping_formatted',
    'text_color',
  ]);
  assert.equal(analysis.counts.undeclared, 11);
});

test('created_at siempre sale como string ISO, venga Date o string', () => {
  const fromDate = analyzeSend(passwordResetSend, []);
  assert.equal(fromDate.created_at, '2026-08-31T17:57:24.780Z');

  const fromString = analyzeSend(
    { ...passwordResetSend, created_at: '2026-08-31T17:57:24.780Z' },
    [],
  );
  assert.equal(fromString.created_at, '2026-08-31T17:57:24.780Z');
});

test('las claves internas del proveedor no se cuentan como no declaradas', () => {
  const analysis = analyzeSend(
    {
      ...passwordResetSend,
      data: { __subject: 'Hola', __html: '<p>x</p>', cde_display_name: 'Desde el sur' },
    },
    [],
  );
  assert.deepEqual(analysis.undeclared.map((v) => v.name), ['cde_display_name']);
});

// ─── Atribución por tienda ────────────────────────────────────────────────────

test('siteAttribution: sin marcador el veredicto es unknown, NO no', () => {
  const site = { id: 'demo_main', channel_ids: ['sc_01X'] };

  // `password-reset` real: ningún marcador. Si esto devolviera `no`, la pantalla
  // esconderría el 100% de los envíos de la plantilla por la que se pidió.
  assert.equal(siteAttribution(PASSWORD_RESET_DATA, site), 'unknown');
  assert.equal(siteAttribution(null, site), 'unknown');
  assert.equal(siteAttribution({}, site), 'unknown');
});

test('siteAttribution: site_id gana y sales_channel_id es el respaldo', () => {
  const site = { id: 'demo_main', channel_ids: ['sc_mine', 'sc_mine_b2b'] };

  assert.equal(siteAttribution({ site_id: 'demo_main' }, site), 'yes');
  assert.equal(siteAttribution({ site_id: 'demo_other' }, site), 'no');

  // El canal B2B cuenta: `channel_ids` son los DOS de la tienda. Mirar sólo el
  // primario es el bug B2B que ya se pagó en los dashboards.
  assert.equal(siteAttribution({ sales_channel_id: 'sc_mine_b2b' }, site), 'yes');
  assert.equal(siteAttribution({ sales_channel_id: 'sc_ajeno' }, site), 'no');

  // Con los dos presentes manda `site_id`: es el eje declarado, el canal es una
  // traducción con pérdida.
  assert.equal(
    siteAttribution({ site_id: 'demo_main', sales_channel_id: 'sc_ajeno' }, site),
    'yes',
  );
});

// ─── Validación del query ─────────────────────────────────────────────────────

test('limit: sin parámetro cae al default; el tope es un tope', () => {
  assert.equal(GetAdminEmailTemplateSends.parse({}).limit, SENDS_DEFAULT_LIMIT);
  assert.equal(GetAdminEmailTemplateSends.parse({ limit: '25' }).limit, 25);
  assert.equal(
    GetAdminEmailTemplateSends.parse({ limit: String(SENDS_MAX_LIMIT) }).limit,
    SENDS_MAX_LIMIT,
  );
});

test('limit inválido REBOTA, no se corrige en silencio', () => {
  // Toda esta feature existe porque el sistema aceptaba datos incompletos sin
  // avisar. Su propia ruta no puede hacer lo mismo con su único parámetro.
  for (const bad of ['0', '-3', 'abc', '', String(SENDS_MAX_LIMIT + 1), '2.5']) {
    assert.throws(
      () => GetAdminEmailTemplateSends.parse({ limit: bad }),
      `limit=${JSON.stringify(bad)} tendría que haber sido rechazado`,
    );
  }
});
