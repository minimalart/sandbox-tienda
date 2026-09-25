import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invalidRecipients, joinRecipientList, parseRecipientList } from './recipient-list';

/**
 * Los avisos internos pueden ir a más de una casilla, y todo el mecanismo cuelga
 * de estas dos funciones: el campo de la tienda y el de la instancia guardan una
 * CADENA, y el provider la parte justo antes de dársela a SendGrid.
 *
 * Lo que se protege acá no es el regex. Es que el criterio del guardado y el del
 * envío sean el MISMO: si la pantalla acepta un separador que el envío no
 * entiende, el operador carga cuatro direcciones, no ve ningún error, y el aviso
 * sale a una sola. Nadie se entera hasta que falta un pedido.
 */

test('una sola casilla sigue siendo una sola casilla', () => {
  // El caso del 100% de los mails al cliente: esto no puede haber cambiado.
  assert.deepEqual(parseRecipientList('info@desdelsur.com.ar'), ['info@desdelsur.com.ar']);
  assert.deepEqual(parseRecipientList('  info@desdelsur.com.ar  '), ['info@desdelsur.com.ar']);
});

test('separa por coma, por punto y coma y por salto de línea', () => {
  const expected = ['a@x.com', 'b@y.com'];
  assert.deepEqual(parseRecipientList('a@x.com,b@y.com'), expected);
  assert.deepEqual(parseRecipientList('a@x.com, b@y.com'), expected);
  assert.deepEqual(parseRecipientList('a@x.com; b@y.com'), expected);
  assert.deepEqual(parseRecipientList('a@x.com\nb@y.com'), expected);
  assert.deepEqual(parseRecipientList('a@x.com\r\nb@y.com'), expected);
});

test('deduplica sin distinguir mayúsculas y conserva el orden', () => {
  // Dos veces el mismo aviso en el mismo buzón se lee como un bug del sistema.
  assert.deepEqual(parseRecipientList('Ventas@x.com, ventas@x.com, admin@x.com'), [
    'Ventas@x.com',
    'admin@x.com',
  ]);
});

test('vacío y nulo no son un destinatario', () => {
  // Los cinco emisores preguntan `if (adminEmail)`: sin esto mandarían a "".
  for (const value of ['', '   ', ' , ; ', null, undefined]) {
    assert.deepEqual(parseRecipientList(value), [], `"${String(value)}" no puede ser una casilla`);
  }
});

test('lo que no parece un mail se descarta sin llevarse el resto', () => {
  // El motivo: esto corre en el camino de envío. Un dedo pegado en la config no
  // puede dejar a las otras casillas sin el aviso de un pedido nuevo.
  assert.deepEqual(parseRecipientList('a@x.com, ventas, b@y.com'), ['a@x.com', 'b@y.com']);
  assert.deepEqual(parseRecipientList('ventas'), []);
});

test('`invalidRecipients` es el reverso exacto del parser', () => {
  // Si los dos criterios se separan, la pantalla guarda algo que el envío tira.
  assert.deepEqual(invalidRecipients('a@x.com, b@y.com'), []);
  assert.deepEqual(invalidRecipients('a@x.com, ventas'), ['ventas']);
  // Nombra CUÁL está mal: con cuatro direcciones, "hay un email inválido" no alcanza.
  assert.deepEqual(invalidRecipients('a@x.com, ventas, roto@'), ['ventas', 'roto@']);
  assert.deepEqual(invalidRecipients(null), []);
});

test('lo que se guarda es lo que el parser vuelve a entender', () => {
  // El lazo completo: la ruta guarda `join(parse(x))`, el provider hace `parse`.
  const messy = ' Ventas@x.com ;; b@y.com , ventas@x.com ';
  const stored = joinRecipientList(parseRecipientList(messy));
  assert.equal(stored, 'Ventas@x.com, b@y.com');
  assert.deepEqual(parseRecipientList(stored), ['Ventas@x.com', 'b@y.com']);
});

/**
 * El provider es lo único que interpreta la lista. Se verifica sobre el fuente
 * porque instanciarlo necesita un container.
 */
const SERVICE = readFileSync(
  join(import.meta.dirname, '..', 'modules', 'email', 'service.ts'),
  'utf8'
);

test('el provider parte el `to` antes de dárselo a SendGrid', () => {
  // Pasarle la cadena cruda la trataría como UNA dirección con comas adentro y
  // SendGrid rebota el envío entero con un 400.
  assert.match(SERVICE, /const recipients = parseRecipientList\(notification\.to\)/);
  assert.match(SERVICE, /const to = recipients\.length \? recipients : notification\.to/);
  assert.doesNotMatch(
    SERVICE,
    /to: notification\.to,/,
    'volvió a mandar el `to` crudo: con varias casillas el envío rebota'
  );
});

test('el descriptor de ADMIN_EMAIL acepta la lista que el parser entiende', () => {
  // El `pattern` es lo que ve el operador. Si se queda en una sola casilla, la
  // pantalla no deja guardar lo que el backend sí sabe mandar.
  const descriptor = readFileSync(
    join(import.meta.dirname, '..', 'modules', 'app-settings', 'descriptors', 'email-templates.ts'),
    'utf8'
  );
  const source = descriptor.match(/pattern:\s*\n?\s*'([^']+)'/)?.[1];
  assert.ok(source, 'ADMIN_EMAIL se quedó sin `pattern`');
  const pattern = new RegExp(source.replace(/\\\\/g, '\\'));
  assert.ok(pattern.test('ventas@x.com'), 'rechaza una sola casilla');
  assert.ok(pattern.test('ventas@x.com, admin@x.com'), 'rechaza la lista con coma');
  assert.ok(pattern.test('ventas@x.com; admin@x.com'), 'rechaza la lista con punto y coma');
  assert.ok(!pattern.test('ventas'), 'acepta algo que no es un mail');
  assert.ok(!pattern.test('ventas@x.com, roto'), 'acepta una lista con una dirección rota');
});
