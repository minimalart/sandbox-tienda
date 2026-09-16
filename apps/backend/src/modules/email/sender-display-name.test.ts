import { test } from 'node:test';
import assert from 'node:assert/strict';

import { senderWithDisplayName } from './service';

/**
 * El nombre visible del remitente.
 *
 * En desdeelsur todos los mails llegaban firmados **"info"**: `EMAIL_FROM` era
 * `info@desdelsur.com.ar` a secas y el cliente de correo, sin display name,
 * muestra el local-part. Es lo único que el destinatario ve en la bandeja antes
 * de abrir el mail, así que el HTML podía estar perfecto y la marca no aparecía
 * en ningún lado.
 */

test('un mail pelado se firma con el nombre de la tienda', () => {
  assert.deepEqual(senderWithDisplayName('info@desdelsur.com.ar', 'Desde el sur'), {
    email: 'info@desdelsur.com.ar',
    name: 'Desde el sur',
  });
});

/**
 * Se devuelve `{email, name}` y no `"Nombre <mail>"` para que el escaping RFC
 * 5322 lo haga la librería: un nombre con coma partido a mano produce un header
 * inválido y SendGrid lo rechaza con un 400 que no explica nada.
 */
test('un nombre con coma no se arma a mano', () => {
  const sender = senderWithDisplayName('info@tienda.com', 'Desde el sur, S.A.');
  assert.equal(typeof sender, 'object');
  assert.deepEqual(sender, { email: 'info@tienda.com', name: 'Desde el sur, S.A.' });
});

/**
 * Quien ya escribió el remitente compuesto a mano sabe lo que quiso: no se le
 * pisa el nombre con el de la tienda. Es además el formato que quedó cargado en
 * producción como arreglo inmediato, antes de que este código se deployara —
 * pisarlo haría que el fix de código ROMPIERA el fix de data.
 */
test('un remitente que ya trae nombre se respeta tal cual', () => {
  const configured = 'Desde el sur <info@desdelsur.com.ar>';
  assert.equal(senderWithDisplayName(configured, 'Otro Nombre'), configured);
});

test('sin nombre de tienda se manda el mail pelado, como antes', () => {
  assert.equal(senderWithDisplayName('info@tienda.com', undefined), 'info@tienda.com');
  assert.equal(senderWithDisplayName('info@tienda.com', '   '), 'info@tienda.com');
});

test('los espacios de más no viajan al header', () => {
  assert.deepEqual(senderWithDisplayName('  info@tienda.com  ', '  Tienda  '), {
    email: 'info@tienda.com',
    name: 'Tienda',
  });
});
