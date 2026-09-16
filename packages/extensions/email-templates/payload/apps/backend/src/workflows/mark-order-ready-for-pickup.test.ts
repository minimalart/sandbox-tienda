import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

import { markOrderReadyForPickup, readyForPickupAt } from './mark-order-ready-for-pickup';

/**
 * El criterio de aceptación de DESDEELSUR-68 que no se puede verificar a ojo:
 * "la nueva notificación se envía UNA SOLA VEZ cuando el pedido se marca como
 * listo para retirar".
 *
 * Hay DOS puertas (el botón del widget y la transición de la entrega a
 * `at_pickup_point`), así que la garantía no puede vivir en ninguna de las dos:
 * vive en `order.metadata.ready_for_pickup_at`, que es lo único que las dos ven.
 * Estos tests entran por la función que ambas llaman.
 */

type Sent = {
  template: string;
  to: string;
  /** `email` o `whatsapp`: los dos avisos salen de la misma función. */
  channel?: string;
  data: Record<string, unknown>;
};

type Fake = {
  container: MedusaContainer;
  sent: Array<Sent>;
  updates: Array<{ id: string; metadata: Record<string, unknown> }>;
};

/** Los avisos de un canal, para no depender del orden de envío. */
const byChannel = (fake: Fake, channel: string): Sent[] =>
  fake.sent.filter((n) => n.channel === channel);

const STORE_ROW = {
  id: 'sloc_melipal',
  name: 'Melipal',
  street: 'Avenida de los Pioneros 4321',
  city: 'San Carlos de Bariloche',
  province: 'Río Negro',
  phone: null,
  business_hours: {
    lunes: { closed: false, is24Hours: false, slots: [{ open: '09:00', close: '18:00' }] },
  },
  lat: '-41.13',
  lng: '-71.36',
  stock_location_id: 'sloc_stock_melipal',
};

function makeFake(order: Record<string, unknown>): Fake {
  const sent: Sent[] = [];
  const updates: Fake['updates'] = [];
  // La orden viva: `updateOrders` la muta, igual que la base, para que un
  // segundo llamado vea lo que escribió el primero.
  const current = { ...order };

  const registry: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
    [ContainerRegistrationKeys.QUERY]: {
      graph: async ({ entity }: { entity: string }) => {
        if (entity === 'order') return { data: [current] };
        if (entity === 'store_location') return { data: [STORE_ROW] };
        return { data: [] };
      },
    },
    [Modules.ORDER]: {
      updateOrders: async (rows: Array<{ id: string; metadata: Record<string, unknown> }>) => {
        for (const row of rows) {
          updates.push(row);
          current.metadata = row.metadata;
        }
      },
    },
    [Modules.NOTIFICATION]: {
      createNotifications: async (n: Sent) => {
        sent.push(n);
      },
    },
  };

  return {
    sent,
    updates,
    container: { resolve: (key: string) => registry[key] } as unknown as MedusaContainer,
  };
}

const PICKUP_ORDER = {
  id: 'order_1',
  display_id: 1042,
  email: 'cliente@ejemplo.com',
  sales_channel_id: 'sc_1',
  metadata: { store_id: 'sloc_melipal' },
  customer: { first_name: 'Juan', last_name: 'Pérez' },
  shipping_methods: [{ name: 'Retiro en tienda', data: { pickup_kind: 'store' } }],
};

/**
 * El mismo pedido, pero con teléfono. `PICKUP_ORDER` NO lo tiene a propósito:
 * `sendWhatsappOrderNotification` omite el envío sin teléfono, así que los tests
 * de mail cuentan un solo aviso. Si algún día se le agrega un teléfono a
 * `PICKUP_ORDER`, los que cuentan por canal siguen diciendo la verdad.
 */
const PICKUP_ORDER_CON_TELEFONO = {
  ...PICKUP_ORDER,
  customer: { first_name: 'Juan', last_name: 'Pérez', phone: '+5492944123456' },
};

// ─── El gate ──────────────────────────────────────────────────────────────────

test('la primera marca manda el mail y sella la orden', async () => {
  const fake = makeFake(PICKUP_ORDER);
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(result.status, 'sent');
  assert.equal(fake.sent.length, 1);
  assert.equal(fake.sent[0]!.template, 'order-ready-for-pickup');
  assert.equal(fake.sent[0]!.to, 'cliente@ejemplo.com');
  assert.equal(fake.updates.length, 1);
  assert.ok(fake.updates[0]!.metadata.ready_for_pickup_at);
});

test('la SEGUNDA marca no manda un segundo mail', async () => {
  const fake = makeFake(PICKUP_ORDER);
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });
  const second = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(second.status, 'already_sent');
  assert.equal(byChannel(fake, 'email').length, 1, 'el comprador recibió DOS avisos del mismo pedido');
});

test('las DOS puertas comparten el gate', async () => {
  // Este es el caso real que motivó el diseño: el operador aprieta el botón del
  // widget y después mueve el estado en la pantalla de delivery. Si cada puerta
  // tuviera su propio gate, acá salen dos mails.
  const fake = makeFake(PICKUP_ORDER);
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });
  const viaDelivery = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'delivery-transition',
  });

  assert.equal(viaDelivery.status, 'already_sent');
  assert.equal(fake.sent.length, 1);
});

test('se sella ANTES de mandar: si el envío falla, la orden queda marcada', async () => {
  // Al revés —mandar y después sellar— un fallo del sellado hace que el
  // reintento mande un segundo mail. Un mail de menos se arregla a mano; uno de
  // más ya llegó.
  const fake = makeFake(PICKUP_ORDER);
  (fake.container.resolve(Modules.NOTIFICATION) as { createNotifications: unknown }).createNotifications =
    async () => {
      throw new Error('SendGrid caído');
    };

  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(result.status, 'sent');
  assert.equal(fake.updates.length, 1, 'la orden tiene que quedar sellada igual');
});

// ─── Los casos que NO tienen que mandar nada ──────────────────────────────────

test('una orden de envío a domicilio no se marca ni avisa', async () => {
  const fake = makeFake({ ...PICKUP_ORDER, metadata: {}, shipping_methods: [{ name: 'Andreani' }] });
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'delivery-transition',
  });

  assert.equal(result.status, 'not_pickup');
  assert.equal(fake.sent.length, 0);
  assert.equal(fake.updates.length, 0, 'no se toca la metadata de una orden que no es de retiro');
});

test('una orden sin email NI teléfono queda marcada pero no manda nada', async () => {
  const fake = makeFake({ ...PICKUP_ORDER, email: null });
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(result.status, 'no_email');
  assert.equal(fake.sent.length, 0);
  assert.equal(fake.updates.length, 1);
});

// ─── Lo que viaja en el mail ──────────────────────────────────────────────────

test('el mail lleva la sucursal, sus horarios y el canal de la tienda', async () => {
  const fake = makeFake(PICKUP_ORDER);
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });

  const data = fake.sent[0]!.data as {
    pickup_store?: { name?: string; address?: string };
    pickup_hours?: string[];
    sales_channel_id?: string;
    display_id?: number;
  };
  assert.equal(data.pickup_store?.name, 'Melipal');
  assert.match(data.pickup_store?.address ?? '', /Avenida de los Pioneros 4321/);
  assert.deepEqual(data.pickup_hours, ['Lunes: 09:00 a 18:00']);
  assert.equal(data.display_id, 1042);
  // Sin el canal el provider resuelve el branding de la fila GLOBAL y el mail
  // sale con el logo de otra tienda.
  assert.equal(data.sales_channel_id, 'sc_1');
});

test('el sellado conserva el resto de la metadata', async () => {
  // `updateOrders` REEMPLAZA el objeto entero. Sin el spread, sellar la orden le
  // borraría `store_id` —la sucursal elegida— y los tickets de los carriers.
  const fake = makeFake({
    ...PICKUP_ORDER,
    metadata: { store_id: 'sloc_melipal', andreani_tickets: [{ id: 'tk_1' }] },
  });
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });

  const metadata = fake.updates[0]!.metadata;
  assert.equal(metadata.store_id, 'sloc_melipal');
  assert.deepEqual(metadata.andreani_tickets, [{ id: 'tk_1' }]);
  assert.equal(metadata.ready_for_pickup_source, 'admin-widget');
});

// ─── El canal de WhatsApp ─────────────────────────────────────────────────────

test('el WhatsApp sale por la MISMA puerta que el mail', async () => {
  // El disparador natural parecía `order.fulfillment_created`, y está mal: los
  // carriers crean fulfillments solos. Colgar los dos canales de esta función es
  // lo que garantiza que el aviso salga cuando una PERSONA dijo que el pedido
  // está en el local, y que no llegue uno sin el otro.
  const fake = makeFake(PICKUP_ORDER_CON_TELEFONO);
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(result.status, 'sent');
  assert.equal(byChannel(fake, 'email').length, 1);
  assert.equal(byChannel(fake, 'whatsapp').length, 1);
  const wsp = byChannel(fake, 'whatsapp')[0]!;
  assert.equal(wsp.template, 'order-ready-for-pickup');
  assert.equal(wsp.to, '+5492944123456');
});

test('el WhatsApp lleva la sucursal y su dirección', async () => {
  // Son los parámetros {{3}} y {{4}} del template aprobado. Una variable que el
  // emisor no manda viaja vacía y Meta rechaza el mensaje entero.
  const fake = makeFake(PICKUP_ORDER_CON_TELEFONO);
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });

  const data = byChannel(fake, 'whatsapp')[0]!.data as {
    store_name?: string;
    store_address?: string;
    display_id?: number;
  };
  assert.equal(data.store_name, 'Melipal');
  assert.match(data.store_address ?? '', /Avenida de los Pioneros 4321/);
  assert.equal(data.display_id, 1042);
});

test('el WhatsApp comparte el gate: la segunda marca no reenvía', async () => {
  const fake = makeFake(PICKUP_ORDER_CON_TELEFONO);
  await markOrderReadyForPickup(fake.container, { orderId: 'order_1', source: 'admin-widget' });
  const viaDelivery = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'delivery-transition',
  });

  assert.equal(viaDelivery.status, 'already_sent');
  assert.equal(byChannel(fake, 'whatsapp').length, 1, 'salieron DOS WhatsApp del mismo pedido');
});

test('una orden SIN mail pero con teléfono recibe el WhatsApp', async () => {
  // El guard de email cortaba la función antes de llegar al WhatsApp. Un pedido
  // de invitado sin mail y con teléfono se quedaba sin ningún aviso.
  const fake = makeFake({ ...PICKUP_ORDER_CON_TELEFONO, email: null });
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'admin-widget',
  });

  assert.equal(result.status, 'no_email');
  assert.equal(byChannel(fake, 'email').length, 0);
  assert.equal(byChannel(fake, 'whatsapp').length, 1);
});

test('una orden que no es de retiro no manda WhatsApp', async () => {
  const fake = makeFake({
    ...PICKUP_ORDER_CON_TELEFONO,
    metadata: {},
    shipping_methods: [{ name: 'Andreani' }],
  });
  const result = await markOrderReadyForPickup(fake.container, {
    orderId: 'order_1',
    source: 'delivery-transition',
  });

  assert.equal(result.status, 'not_pickup');
  assert.equal(fake.sent.length, 0);
});

// ─── El lector del sello ──────────────────────────────────────────────────────

test('readyForPickupAt sólo acepta una marca real', () => {
  assert.equal(readyForPickupAt({ ready_for_pickup_at: '2026-09-14T12:00:00.000Z' }), '2026-09-14T12:00:00.000Z');
  assert.equal(readyForPickupAt({ ready_for_pickup_at: '' }), null);
  assert.equal(readyForPickupAt({ ready_for_pickup_at: '   ' }), null);
  assert.equal(readyForPickupAt({}), null);
  assert.equal(readyForPickupAt(null), null);
});

// ─── La segunda puerta, del lado del workflow de delivery ─────────────────────

const TRANSITION_SRC = readFileSync(
  join(import.meta.dirname, 'transition-delivery-execution.ts'),
  'utf8',
);

test('el aviso de retiro se emite SOLO para store_pickup', () => {
  // Andreani también pasa por `at_pickup_point` cuando deja el paquete en una
  // sucursal SUYA. Sin este gate, al comprador se le manda a buscar el pedido a
  // un local nuestro que nunca lo tuvo.
  assert.match(
    TRANSITION_SRC,
    /projection\.provider_type === 'store_pickup'/,
    'falta gatear el evento por provider_type',
  );
  assert.match(TRANSITION_SRC, /delivery\.store_pickup_ready/);
});
