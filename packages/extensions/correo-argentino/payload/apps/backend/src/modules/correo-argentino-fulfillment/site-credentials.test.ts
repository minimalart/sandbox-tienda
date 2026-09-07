import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyCorreoSiteCredentials } from './site-credentials';
import type { CorreoProviderOptions } from './types';

/**
 * Las credenciales por tienda tienen que LLEGAR al cliente de MiCorreo.
 *
 * Regresión de un bug que no daba ningún error: el blob de `site_credential` es
 * PLANO (`micorreoUser`, `customerId`) y `CorreoProviderOptions` NO —las guarda
 * anidadas en `micorreo`—. El código hacía `{ ...options, ...creds } as never`, así
 * que esas claves quedaban colgando en la raíz, donde `MiCorreoClient` nunca las
 * lee (`this.options.micorreo.customerId`). Resultado: la tienda cargaba su cuenta,
 * la pantalla la mostraba cargada, y cotizaba igual con el `customerId` del
 * entorno — o sea con la identidad de otro comerciante. El `as never` era
 * exactamente lo que evitaba que TypeScript lo marcara.
 */

const base = {
  apiKey: 'env-api-key',
  agreement: '18018',
  sellerId: 'env-seller',
  micorreo: { username: 'env-user', password: 'env-pass', customerId: 'env-customer' },
} as unknown as CorreoProviderOptions;

test('el customerId de la tienda llega anidado, que es donde el cliente lo lee', () => {
  // El que más importa: usuario y contraseña de MiCorreo son por INTEGRADOR
  // (types.ts:97-103); la identidad del comerciante va toda en `customerId`.
  const out = applyCorreoSiteCredentials(base, { customerId: 'norte-customer' });
  assert.equal(out.micorreo.customerId, 'norte-customer');
  assert.equal((out as Record<string, unknown>).customerId, undefined, 'quedó colgando en la raíz');
});

test('usuario y contraseña de MiCorreo se mapean a micorreo.username/password', () => {
  const out = applyCorreoSiteCredentials(base, {
    micorreoUser: 'norte-user',
    micorreoPassword: 'norte-pass',
  });
  assert.equal(out.micorreo.username, 'norte-user');
  assert.equal(out.micorreo.password, 'norte-pass');
});

test('apiKey y sellerId sí van en la raíz', () => {
  const out = applyCorreoSiteCredentials(base, { apiKey: 'norte-key', sellerId: 'norte-seller' });
  assert.equal(out.apiKey, 'norte-key');
  assert.equal(out.sellerId, 'norte-seller');
});

test('lo que la tienda no declara se hereda del entorno', () => {
  // Es lo que permite cargar sólo el customerId propio y seguir usando las
  // credenciales de integrador que son comunes a toda la instancia.
  const out = applyCorreoSiteCredentials(base, { customerId: 'norte-customer' });
  assert.equal(out.micorreo.username, 'env-user');
  assert.equal(out.apiKey, 'env-api-key');
  assert.equal(out.agreement, '18018');
});

test('un valor vacío no pisa el del entorno con ""', () => {
  const out = applyCorreoSiteCredentials(base, { customerId: '   ', apiKey: '' });
  assert.equal(out.micorreo.customerId, 'env-customer');
  assert.equal(out.apiKey, 'env-api-key');
});

/**
 * `agreement` se sumó con la migración a `app-settings`, y es la clave que
 * faltaba. Sin ella, una tienda podía cargar su propia API key y su propio
 * customerId —la pantalla la mostraba completa— y seguía DESPACHANDO contra el
 * acuerdo del entorno: el flete se factura al CUIT de otro titular y el
 * `trackingNumber` propio, que se deriva del acuerdo, puede colisionar adentro de
 * un acuerdo ajeno. Eso último es irrecuperable.
 */
test('el acuerdo de la tienda pisa al del entorno', () => {
  const out = applyCorreoSiteCredentials(base, { agreement: '99999' });
  assert.equal(out.agreement, '99999');
});

test('sin acuerdo propio se hereda el del entorno', () => {
  assert.equal(applyCorreoSiteCredentials(base, { apiKey: 'x' }).agreement, '18018');
});

test('el sellerId DERIVADO sigue al acuerdo de la tienda', () => {
  // `normalizeCorreoOptions` deriva `sellerId` del `agreement` cuando no hay uno
  // configurado. Si acá no lo siguiera, una tienda que sólo carga su acuerdo
  // firmaría los envíos con el sellerId derivado del acuerdo del ENTORNO —
  // exactamente la mezcla que esta función existe para evitar.
  const derivado = { ...base, sellerId: '18018' } as unknown as CorreoProviderOptions;
  const out = applyCorreoSiteCredentials(derivado, { agreement: '99999' });
  assert.equal(out.sellerId, '99999');
});

test('un sellerId propio de la tienda gana sobre el derivado del acuerdo', () => {
  const derivado = { ...base, sellerId: '18018' } as unknown as CorreoProviderOptions;
  const out = applyCorreoSiteCredentials(derivado, {
    agreement: '99999',
    sellerId: 'norte-seller',
  });
  assert.equal(out.sellerId, 'norte-seller');
});

test('un sellerId EXPLÍCITO del entorno no se pisa al cambiar el acuerdo', () => {
  // En `base`, `sellerId` ('env-seller') es distinto del acuerdo: fue configurado a
  // mano, así que no es una derivación y no tiene por qué seguir al acuerdo nuevo.
  const out = applyCorreoSiteCredentials(base, { agreement: '99999' });
  assert.equal(out.sellerId, 'env-seller');
});
