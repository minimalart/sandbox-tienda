import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOrderTrackingData, buildTrackingTimeline } from './order-tracking-context.ts';

const ORDER = {
  id: 'order_1',
  display_id: 42,
  created_at: '2026-09-15T10:00:00.000Z',
  email: 'cliente@ejemplo.com',
  customer: { first_name: 'Belén', last_name: 'Sánchez' },
  shipping_address: { first_name: 'Belén', address_1: 'Av. Siempreviva 742', city: 'Bariloche' },
};

test('el hito viaja SIEMPRE: sin él la plantilla dice "¡Pago confirmado!" en el mail de entrega', () => {
  /**
   * `orderTrackingTemplate` cae a `payment_confirmed` cuando no le mandan
   * `current_milestone`. Es el modo de falla más caro de este mail: sale, llega,
   * se ve bien, y le dice al cliente lo contrario de lo que pasó.
   */
  const entregado = buildOrderTrackingData(ORDER, { milestone: 'delivered' });
  assert.equal(entregado.current_milestone, 'delivered');

  const enCamino = buildOrderTrackingData(ORDER, { milestone: 'shipped' });
  assert.equal(enCamino.current_milestone, 'shipped');
});

test('la línea de tiempo marca cumplido hasta el hito y deja el resto pendiente', () => {
  const pasos = buildTrackingTimeline('shipped', { placed_at: ORDER.created_at });
  assert.deepEqual(
    pasos.map((p) => [p.label, p.done]),
    [
      ['Pedido realizado', true],
      ['Pago confirmado', true],
      ['En preparación', true],
      ['Enviado', true],
      ['Entregado', false],
    ],
  );

  const entregado = buildTrackingTimeline('delivered', { placed_at: ORDER.created_at });
  assert.ok(entregado.every((p) => p.done), 'con el pedido entregado no puede quedar un paso pendiente');
});

test('sólo se fechan los pasos que se conocen de verdad', () => {
  // Inventar fechas para los intermedios es peor que dejarlos vacíos: la
  // plantilla las muestra tal cual y el cliente las lee como si hubieran pasado.
  const pasos = buildTrackingTimeline('shipped', {
    placed_at: ORDER.created_at,
    milestone_at: '2026-09-17T18:00:00.000Z',
  });
  assert.equal(pasos[0].date_iso, ORDER.created_at);
  assert.equal(pasos[1].date_iso, null);
  assert.equal(pasos[2].date_iso, null);
  assert.equal(pasos[3].date_iso, '2026-09-17T18:00:00.000Z');
  assert.equal(pasos[4].date_iso, null);
});

test('los iconos son los del storefront, en su orden', () => {
  // La plantilla decide el PNG por `index` + `icon` (`resolveTimelineIconFilename`).
  // Si esta lista se desordena, el mail muestra el camión en "En preparación".
  assert.deepEqual(
    buildTrackingTimeline('delivered').map((p) => p.icon),
    ['dollar', 'dollar', 'package', 'truck', 'pin'],
  );
});

test('el tracking viaja sólo cuando el emisor lo sabe', () => {
  // Un reparto de flota propia o un retiro en tienda no tienen número de carrier.
  const flotaPropia = buildOrderTrackingData(ORDER, { milestone: 'shipped' });
  assert.equal(flotaPropia.tracking_number, undefined);
  assert.equal(flotaPropia.tracking_url, undefined);

  const conCarrier = buildOrderTrackingData(ORDER, {
    milestone: 'shipped',
    trackingNumber: '123456789',
    trackingUrl: 'https://andreani.com/123456789',
  });
  assert.equal(conCarrier.tracking_number, '123456789');
  assert.equal(conCarrier.tracking_url, 'https://andreani.com/123456789');
});

test('una orden sin dirección de envío no rompe el armado', () => {
  // El retiro en tienda no tiene `shipping_address`, y el mail de "entregado"
  // igual tiene que salir.
  const data = buildOrderTrackingData({ id: 'order_2', email: 'x@y.com' }, { milestone: 'delivered' });
  assert.equal(data.shipping_address, null);
  assert.equal(data.customer_name, undefined);
  assert.equal(data.current_milestone, 'delivered');
});
