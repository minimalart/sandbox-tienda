import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chosenStoreLocationId,
  classifyStock,
  formatBusinessHours,
  buildMapUrl,
} from './pickup-context';

/**
 * El contexto de retiro en tienda que alimenta los tres mails de DESDEELSUR-68.
 *
 * Lo que se prueba acá son las tres decisiones que, si salen mal, producen un
 * mail que MIENTE: qué sucursal eligió el comprador, cuánto hay en esa sucursal,
 * y qué horarios tiene. Ninguna rompe nada al fallar — el mail sale igual, con el
 * dato equivocado. Por eso van con test.
 */

// ─── Qué sucursal eligió ──────────────────────────────────────────────────────

test('la sucursal sale de la metadata de la orden', () => {
  assert.equal(chosenStoreLocationId({ store_id: 'sloc_melipal' }, []), 'sloc_melipal');
});

test('si no está en la metadata, cae al método de envío', () => {
  assert.equal(
    chosenStoreLocationId({}, [{ data: { store_id: 'sloc_elordi' } }]),
    'sloc_elordi',
  );
});

test('un `store_id` VACÍO se lee como "no eligió", no como id', () => {
  // Al cambiar de modo de entrega el storefront LIMPIA el campo escribiendo
  // `store_id: ''` en vez de borrarlo. Leerlo como id haría que una orden de
  // envío a domicilio se trate como retiro y el comprador reciba el aviso de
  // las 24 h para un local al que no tiene que ir.
  assert.equal(chosenStoreLocationId({ store_id: '' }, []), null);
  assert.equal(chosenStoreLocationId({ store_id: '   ' }, []), null);
  // Y con el campo vacío arriba, el respaldo del método SÍ tiene que valer.
  assert.equal(
    chosenStoreLocationId({ store_id: '' }, [{ data: { store_id: 'sloc_km13' } }]),
    'sloc_km13',
  );
});

test('una orden sin nada de esto no es de retiro', () => {
  assert.equal(chosenStoreLocationId({}, []), null);
  assert.equal(chosenStoreLocationId(undefined, []), null);
  assert.equal(chosenStoreLocationId(null, [{ name: 'Andreani a domicilio' }]), null);
});

// ─── Los tres estados de stock que pide el ticket ─────────────────────────────

test('alcanza para lo pedido → disponible', () => {
  assert.equal(classifyStock(2, 5), 'available');
  // El empate exacto TAMBIÉN alcanza.
  assert.equal(classifyStock(5, 5), 'available');
});

test('hay algo pero no lo suficiente → insuficiente', () => {
  assert.equal(classifyStock(5, 2), 'insufficient');
  assert.equal(classifyStock(2, 1), 'insufficient');
});

test('no hay nada → sin stock', () => {
  assert.equal(classifyStock(3, 0), 'none');
  // Un negativo (sobreventa) tampoco es "hay".
  assert.equal(classifyStock(3, -2), 'none');
});

test('"no pudimos consultar" NO se reporta como "sin stock"', () => {
  // Es la distinción que más importa del archivo. Decirle al operador que no hay
  // mercadería cuando en realidad la consulta de inventario falló lo manda a
  // cancelar una venta que podía preparar. `insufficient` pide mirar; `none`
  // afirma algo que no sabemos.
  assert.equal(classifyStock(3, null), 'insufficient');
  assert.notEqual(classifyStock(3, null), 'none');
});

// ─── Horarios ─────────────────────────────────────────────────────────────────

test('los días se indexan en ESPAÑOL, que es como los escribe el admin', () => {
  // El editor del admin y las 4 sucursales de producción usan `lunes`/`martes`/…
  // Indexar por `monday` devuelve [] y el bloque de horarios sale vacío sin que
  // falle nada — exactamente lo que le pasa hoy al helper del bot de WhatsApp.
  const hours = formatBusinessHours({
    lunes: { closed: false, is24Hours: false, slots: [{ open: '09:00', close: '18:00' }] },
  });
  assert.deepEqual(hours, ['Lunes: 09:00 a 18:00']);
});

test('los días consecutivos con el mismo horario se agrupan', () => {
  const day = { closed: false, is24Hours: false, slots: [{ open: '09:00', close: '18:00' }] };
  const sabado = { closed: false, is24Hours: false, slots: [{ open: '09:00', close: '13:00' }] };
  const hours = formatBusinessHours({
    lunes: day,
    martes: day,
    miercoles: day,
    jueves: day,
    viernes: day,
    sabado,
    domingo: { closed: true, is24Hours: false, slots: [] },
  });
  // Es la forma real de las 4 sucursales de desdeelsur.
  assert.deepEqual(hours, ['Lunes a Viernes: 09:00 a 18:00', 'Sábado: 09:00 a 13:00']);
});

test('los días cerrados no se listan', () => {
  const hours = formatBusinessHours({
    lunes: { closed: true, is24Hours: false, slots: [] },
    domingo: { closed: true, is24Hours: false, slots: [] },
  });
  assert.deepEqual(hours, []);
});

test('sin horarios configurados devuelve vacío, no rompe', () => {
  // El ticket pide los horarios "si se encuentran configurados": la ausencia es
  // un caso legítimo y la plantilla no dibuja el bloque.
  assert.deepEqual(formatBusinessHours(null), []);
  assert.deepEqual(formatBusinessHours(undefined), []);
  assert.deepEqual(formatBusinessHours('9 a 18'), []);
  assert.deepEqual(formatBusinessHours({}), []);
});

// ─── Cómo llegar ──────────────────────────────────────────────────────────────

test('el mapa se arma con las coordenadas guardadas', () => {
  const url = buildMapUrl({ lat: '-41.13', lng: '-71.30', street: 'Elflein 1072' });
  assert.match(url ?? '', /query=-41\.13%2C-71\.30/);
});

test('sin coordenadas cae a la dirección, y sin dirección no hay link', () => {
  const url = buildMapUrl({ street: 'Elflein 1072', city: 'Bariloche', province: 'Río Negro' });
  assert.match(url ?? '', /Elflein/);
  assert.equal(buildMapUrl({}), undefined);
});
