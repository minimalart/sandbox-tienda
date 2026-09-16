import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type ClaimableOrderInput,
  isClaimableByCustomer,
  selectClaimableOrders,
} from './claimable-orders';

/**
 * DESDEELSUR-61 / BUG-07: la compra hecha como invitado con un email que ya
 * tenía cuenta no aparecía nunca en "Mis pedidos".
 *
 * Lo que se fija acá NO es la funcionalidad — es el límite. El modo de fallo de
 * este filtro es silencioso: un corte de menos lista los pedidos de otra
 * persona, con sus montos, y nada se rompe ni queda en un log. Cada test de
 * abajo es un vector concreto que tiene que quedar cerrado.
 */

const CHANNEL = 'sc_desdeelsur';
const ME = {
  id: 'cus_registrada',
  email: 'ana@example.com',
  salesChannelIds: [CHANNEL],
};

const order = (overrides: Partial<ClaimableOrderInput> = {}): ClaimableOrderInput => ({
  id: 'order_1',
  display_id: 30,
  email: 'ana@example.com',
  created_at: '2026-09-09T12:00:00.000Z',
  total: 171274,
  currency_code: 'ars',
  customer_id: 'cus_invitada',
  sales_channel_id: CHANNEL,
  customer: { has_account: false },
  ...overrides,
});

test('el caso que hay que reparar: orden de un invitado con mi mismo email', () => {
  assert.equal(isClaimableByCustomer(order(), ME), true);
});

test('una orden totalmente huérfana también se ofrece', () => {
  assert.equal(
    isClaimableByCustomer(
      order({ customer_id: null, customer: null }),
      ME,
    ),
    true,
  );
});

test('lo que ya es mío no se ofrece de nuevo', () => {
  // Aparece por el camino normal de `GET /store/orders`; ofrecer "vincular"
  // algo ya vinculado sólo confunde.
  assert.equal(
    isClaimableByCustomer(
      order({ customer_id: ME.id, customer: { has_account: true } }),
      ME,
    ),
    false,
  );
});

test('CANDADO: una orden de OTRO email nunca se ofrece', () => {
  for (const email of [
    'otra@example.com',
    'ana@otrodominio.com',
    'ana+alias@example.com', // el alias es otra dirección, no la misma
    null,
    undefined,
    '',
  ]) {
    assert.equal(
      isClaimableByCustomer(order({ email }), ME),
      false,
      String(email),
    );
  }
});

test('CANDADO: una orden de OTRA CUENTA registrada con el mismo email no se ofrece', () => {
  // Acá no hay un invitado huérfano: hay otra cuenta. Ofrecer su pedido sería
  // apropiación, y es el vector por el que este módulo no reasigna solo.
  assert.equal(
    isClaimableByCustomer(
      order({ customer_id: 'cus_otra_cuenta', customer: { has_account: true } }),
      ME,
    ),
    false,
  );
});

test('el email se compara normalizado: mayúsculas y espacios no son otra persona', () => {
  assert.equal(
    isClaimableByCustomer(order({ email: '  ANA@Example.com ' }), ME),
    true,
  );
  assert.equal(
    isClaimableByCustomer(order(), { ...ME, email: 'ANA@EXAMPLE.COM' }),
    true,
  );
});

test('CANDADO: una orden de OTRA TIENDA de la plataforma no se ofrece', () => {
  // La compra es de la misma persona, pero `listOrders` filtra por el sales
  // channel del tenant: vincularla la haría desaparecer del listado igual, y
  // mientras tanto le muestra a un cliente lo que compró en otra marca.
  assert.equal(
    isClaimableByCustomer(order({ sales_channel_id: 'sc_mercatto' }), ME),
    false,
  );
  // Una orden vieja sin canal sí se ofrece: es el mismo criterio de
  // compatibilidad que ya aplica `listOrders`.
  assert.equal(
    isClaimableByCustomer(order({ sales_channel_id: null }), ME),
    true,
  );
  // Con varios canales autorizados alcanza que la orden esté en alguno.
  assert.equal(
    isClaimableByCustomer(order({ sales_channel_id: 'sc_b2b' }), {
      ...ME,
      salesChannelIds: [CHANNEL, 'sc_b2b'],
    }),
    true,
  );
});

test('sin identidad completa no se ofrece nada', () => {
  // Un customer sin email (o sin id) no puede reclamar por coincidencia: sin
  // email el filtro no tiene con qué comparar y devolvería cualquier cosa.
  assert.equal(isClaimableByCustomer(order(), { ...ME, email: null }), false);
  assert.equal(isClaimableByCustomer(order(), { ...ME, email: '   ' }), false);
  assert.equal(isClaimableByCustomer(order(), { ...ME, id: '' }), false);
  // Sin canales autorizados no se sabe de qué tienda viene el visitante. El
  // default es cerrado: ofrecer "todas" sería lo contrario de filtrar por tienda.
  assert.equal(
    isClaimableByCustomer(order(), { ...ME, salesChannelIds: [] }),
    false,
  );
});

test('selectClaimableOrders proyecta sólo lo mínimo y filtra el resto', () => {
  const result = selectClaimableOrders(
    [
      order({ id: 'order_mia', customer_id: ME.id }),
      order({ id: 'order_ajena', email: 'otra@example.com' }),
      order({
        id: 'order_otra_cuenta',
        customer_id: 'cus_otra',
        customer: { has_account: true },
      }),
      order({ id: 'order_otra_tienda', sales_channel_id: 'sc_mercatto' }),
      order({ id: 'order_reclamable' }),
    ],
    ME,
  );

  assert.deepEqual(result, [
    {
      id: 'order_reclamable',
      display_id: 30,
      created_at: '2026-09-09T12:00:00.000Z',
      total: 171274,
      currency_code: 'ars',
    },
  ]);
});

test('un `created_at` como Date se serializa, y una lista vacía o nula no explota', () => {
  const [projected] = selectClaimableOrders(
    [order({ created_at: new Date('2026-09-09T12:00:00.000Z') })],
    ME,
  );
  assert.equal(projected.created_at, '2026-09-09T12:00:00.000Z');

  assert.deepEqual(selectClaimableOrders([], ME), []);
  assert.deepEqual(selectClaimableOrders(null, ME), []);
  assert.deepEqual(selectClaimableOrders(undefined, ME), []);
});
