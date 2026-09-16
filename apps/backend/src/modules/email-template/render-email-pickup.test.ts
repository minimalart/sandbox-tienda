import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderPuckEmailHtml, type PuckEmailDocument } from './render-email';
import { renderEmailTemplate } from './render';

/**
 * El bloque `PickupStore` de punta a punta: documento Puck → HTML → pasada de
 * Handlebars con datos reales.
 *
 * Se testea la cadena COMPLETA y no sólo el markup generado a propósito. El
 * bloque emite Handlebars (`{{#if}}`, `{{#with}}`, `{{../primary_color}}`) que
 * recién significa algo en la segunda pasada, y Handlebars resuelve una
 * expresión inválida a cadena vacía SIN error. Un test que sólo mirara el
 * template intermedio pasaría en verde con un `{{#with}}` mal anidado y el mail
 * saldría sin la sucursal, que es exactamente el bug que este bloque viene a
 * arreglar.
 */

const DESIGN: PuckEmailDocument = {
  content: [{ type: 'PickupStore', props: { id: 'p1' } } as never],
};

const STORE = {
  id: 'sloc_1',
  name: 'Sucursal Elflein',
  address: 'Elflein 123, Bariloche',
  phone: '294 400-1234',
  hours: ['Lunes a viernes: 09:00 a 18:00', 'Sábados: 09:00 a 13:00'],
  map_url: 'https://maps.google.com/?q=-41.13,-71.31',
};

async function renderWith(data: Record<string, unknown>): Promise<string> {
  const html = await renderPuckEmailHtml(DESIGN);
  return renderEmailTemplate({ subject: '', html, data }).html;
}

test('retiro en tienda: imprime la sucursal elegida', async () => {
  const out = await renderWith({
    is_store_pickup: true,
    pickup_store: STORE,
    primary_color: '#2e7d32',
  });

  assert.match(out, /Retiralo en/);
  assert.match(out, /Sucursal Elflein/);
  assert.match(out, /Elflein 123, Bariloche/);
  assert.match(out, /294 400-1234/);
  assert.match(out, /Lunes a viernes: 09:00 a 18:00/);
  assert.match(out, /Sábados: 09:00 a 13:00/);
  assert.match(out, /maps\.google\.com/);
});

/**
 * `{{../primary_color}}` sube del `{{#with pickup_store}}` al contexto raíz. Si
 * el nivel está mal contado la expresión resuelve a vacío, el atributo queda
 * `color:;` —CSS inválido que el cliente de correo descarta— y el encabezado
 * sale negro sin que nada falle. Mismo modo de falla que el botón sin color de
 * los envíos de prueba.
 */
test('el color de marca cruza el #with y llega al encabezado', async () => {
  const out = await renderWith({
    is_store_pickup: true,
    pickup_store: STORE,
    primary_color: '#2e7d32',
  });

  assert.match(out, /color:#2e7d32/);
  assert.doesNotMatch(out, /color:;/);
});

test('envío a domicilio: no imprime absolutamente nada', async () => {
  const out = await renderWith({
    is_store_pickup: false,
    pickup_store: null,
    primary_color: '#2e7d32',
  });

  assert.doesNotMatch(out, /Retiralo en/);
  assert.doesNotMatch(out, /Sucursal/);
});

/**
 * El caso que justifica el doble gate. `buildPickupContext` deja `pickup_store`
 * ausente cuando la orden ES de retiro pero la sucursal no se pudo leer (no
 * tira, por diseño). Gatear sólo por `is_store_pickup` imprimiría el encabezado
 * "Retiralo en" sobre una caja vacía: el cliente se queda esperando una
 * dirección que no llega, que es peor que no decir nada.
 */
test('retiro sin sucursal resuelta: no imprime el encabezado huérfano', async () => {
  const out = await renderWith({
    is_store_pickup: true,
    pickup_store: null,
    primary_color: '#2e7d32',
  });

  assert.doesNotMatch(out, /Retiralo en/);
});

test('los campos opcionales ausentes no dejan etiquetas colgadas', async () => {
  const out = await renderWith({
    is_store_pickup: true,
    pickup_store: { id: 'sloc_2', name: 'Sucursal Km 13', address: '', hours: [] },
    primary_color: '#2e7d32',
  });

  assert.match(out, /Sucursal Km 13/);
  // Sin teléfono no queda un "Tel:" pelado, y sin horarios no queda el título
  // "Horarios" encabezando una lista vacía.
  assert.doesNotMatch(out, /Tel:/);
  assert.doesNotMatch(out, /Horarios/);
  assert.doesNotMatch(out, /Ver en el mapa/);
});

test('los interruptores del bloque apagan horarios y mapa', async () => {
  const html = await renderPuckEmailHtml({
    content: [
      { type: 'PickupStore', props: { id: 'p1', showHours: 'no', showMap: 'no' } } as never,
    ],
  });
  const out = renderEmailTemplate({
    subject: '',
    html,
    data: { is_store_pickup: true, pickup_store: STORE, primary_color: '#2e7d32' },
  }).html;

  assert.match(out, /Sucursal Elflein/);
  assert.doesNotMatch(out, /Horarios/);
  assert.doesNotMatch(out, /Ver en el mapa/);
});
