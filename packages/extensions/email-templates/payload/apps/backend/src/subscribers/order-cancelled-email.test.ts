import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildOrderCancelledData, ORDER_CANCELLED_SUBJECT } from './order-cancelled-email';
import { EMAIL_TEMPLATE_VARIABLES } from '../modules/email/template-variables';

/**
 * La fila `order-cancelled` estuvo PUBLICADA en la base, editable en el admin y con
 * su diseño propio, y no la usaba nadie: el único emisor de esa key era
 * `order-cancelled-whatsapp.ts`, con `channel: 'whatsapp'`. Cancelar un pedido no
 * mandaba un solo correo, y nunca lo había mandado.
 *
 * Es el mismo modo de falla que la key muerta `pedido-cancelado`, un escalón más
 * arriba: ahí la key estaba mal escrita, acá la key está bien y faltaba el emisor.
 * Los dos son invisibles por la misma razón — nada en el camino falla. No hay
 * excepción, no hay log, no hay fila de notificación fallida. Simplemente no pasa.
 *
 * Por eso estos tests miran DOS cosas distintas:
 *  1. Que el emisor exista y sea de mail (lo que faltaba).
 *  2. Que las variables que el admin promete viajen de verdad (lo que hace que un
 *     emisor que existe igual mande un mail roto).
 */

const SOURCE = readFileSync(join(import.meta.dirname, 'order-cancelled-email.ts'), 'utf8');
const SERVICE = readFileSync(
  join(import.meta.dirname, '..', 'modules', 'email', 'service.ts'),
  'utf8',
);

/** Una orden como la devuelve `query.graph` con los campos que pide el subscriber. */
const ORDER = {
  id: 'order_01ABC',
  display_id: 8,
  created_at: '2026-06-16T17:30:00.000Z',
  email: 'cliente@ejemplo.com',
  sales_channel_id: 'sc_01XYZ',
  customer: { first_name: 'Juan', last_name: 'Pérez' },
};

test('el subscriber es de EMAIL y escucha la cancelación', () => {
  // El assert que falla con el código viejo: no existía ningún emisor con
  // `channel: 'email'` para esta key.
  assert.match(SOURCE, /channel: 'email'/);
  assert.match(SOURCE, /template: 'order-cancelled'/);
  assert.match(SOURCE, /event: 'order\.canceled'/);
});

test('declara la tienda de la orden', () => {
  // Sin `sales_channel_id` el proveedor cae al sitio implícito. La fila real de
  // desdeelsur tiene `site_id = 'demo_main'`, así que sin el eje la plantilla que
  // el operador publicó es inalcanzable y sale el HTML del código.
  const data = buildOrderCancelledData(ORDER);
  assert.equal(data.sales_channel_id, 'sc_01XYZ');
});

/**
 * Las variables que el proveedor rellena solo, leídas del FUENTE de `service.ts`
 * en vez de copiadas: si mañana alguien saca un `fillEmpty`, este test se entera.
 * Es la misma técnica que usa `template-variables.test.ts` con el catálogo.
 */
function autoFilledByProvider(): Set<string> {
  return new Set([...SERVICE.matchAll(/fillEmpty\('([a-z0-9_]+)'/g)].map((m) => m[1]));
}

test('el proveedor sigue rellenando las variables de marca', () => {
  // Guard contra falso verde: si la extracción devolviera vacío, el test de abajo
  // pasaría por no exigir nada.
  const auto = autoFilledByProvider();
  assert.ok(auto.size >= 5, `esperaba varios fillEmpty, encontré ${auto.size}`);
  assert.ok(auto.has('sales_channel_name'), 'el asunto de la fila real empieza con esta variable');
});

test('toda variable declarada para la key viaja, o la rellena el proveedor', () => {
  const declaradas = EMAIL_TEMPLATE_VARIABLES['order-cancelled'].map((v) => v.name);
  assert.ok(declaradas.length > 0, 'la key tiene que declarar variables');

  const data = buildOrderCancelledData(ORDER);
  const auto = autoFilledByProvider();

  const ausentes = declaradas.filter((name) => data[name] === undefined && !auto.has(name));

  assert.deepEqual(
    ausentes,
    [],
    `estas variables se le ofrecen al operador en el editor y no las manda nadie: ${ausentes.join(', ')}. ` +
      'Handlebars resuelve la ausente a cadena vacía SIN error, así que el mail sale ' +
      'con un hueco (un asunto "[] …" o un "$0") y no queda registro en ningún lado.',
  );
});

test('el nombre cae a la dirección cuando la compra fue de invitado', () => {
  // En el checkout de invitado el `customer` no tiene nombre cargado y el único
  // lugar donde el comprador lo escribió es la dirección de envío.
  const data = buildOrderCancelledData({
    ...ORDER,
    customer: null,
    shipping_address: { first_name: 'Ana', last_name: 'Gómez' },
  });
  assert.equal(data.customer_name, 'Ana Gómez');
});

test('sin nombre por ningún lado la variable es undefined, no cadena vacía', () => {
  // La plantilla la envuelve en `{{#if customer_name}}`: con '' el `if` es falso
  // igual, pero con undefined tampoco se pisa un valor que rellenara el proveedor.
  const data = buildOrderCancelledData({ ...ORDER, customer: null });
  assert.equal(data.customer_name, undefined);
});

test('una fecha inválida no se convierte en "Invalid Date" en el mail', () => {
  // `new Date('vaya')` no tira: da un Date NaN que `Intl` formatea como texto.
  const data = buildOrderCancelledData({ ...ORDER, created_at: 'vaya' });
  assert.equal(data.order_date_formatted, undefined);
});

test('el asunto viaja como variable propia', () => {
  // La fila hermana `order-tracking` interpola `{{subject}}` en su asunto. Acá la
  // variable está declarada y el operador la ve ofrecida: si la escribe, tiene que
  // resolver a algo.
  const data = buildOrderCancelledData(ORDER);
  assert.equal(data.subject, ORDER_CANCELLED_SUBJECT);
  assert.ok(String(data.subject).length > 0);
});

test('no se piden items ni totales a columnas que no existen', () => {
  // Esta plantilla no muestra líneas ni importes, así que no hay nada que pedir.
  // Si algún día se agregan, tiene que ser por `items.detail.quantity`:
  // `items.quantity` se remapea a `items.item.quantity`, que no es una columna, y
  // devuelve undefined sin error — de ahí salían los $0 de `order-placed-email`.
  assert.doesNotMatch(SOURCE, /'items\.quantity'/);
  assert.doesNotMatch(SOURCE, /'items\.total'/);
  assert.doesNotMatch(SOURCE, /'items\.detail\.total'/);
});

test('el emisor de mail es un archivo aparte del de WhatsApp', () => {
  // El hermano de WhatsApp corta con `return` cuando la orden no tiene teléfono
  // —el caso corriente en el checkout de invitado—. Si el mail viviera adentro de
  // ese archivo, ese `return` se lo llevaría puesto teniendo destinatario válido.
  const whatsapp = readFileSync(
    join(import.meta.dirname, 'order-cancelled-whatsapp.ts'),
    'utf8',
  );
  assert.doesNotMatch(
    whatsapp,
    /channel: 'email'/,
    'el canal de mail no puede depender de que la orden tenga teléfono',
  );
});
