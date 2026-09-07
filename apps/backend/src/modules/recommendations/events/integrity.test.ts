import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyIncomingEvents, eventIdempotencyKey, type ServedRow } from './integrity';

const NOW = new Date('2026-07-24T12:00:00.000Z');

const served = (overrides: Partial<ServedRow> = {}): ServedRow => ({
  request_id: 'recq_abc.def',
  placement: 'product-detail-fbt',
  strategy_key: 'frequently_bought_together',
  resolved_strategy_key: 'manual',
  fallback_used: true,
  version_id: 'recver_1',
  source_product_id: 'prod_source',
  cart_id: 'cart_1',
  customer_id: 'cus_1',
  session_id: 'sess_1',
  sales_channel_id: 'sc_main',
  region_id: 'reg_1',
  currency_code: 'ars',
  served_product_ids: ['prod_a', 'prod_b'],
  occurred_at: new Date('2026-07-24T11:59:00.000Z'),
  ...overrides,
});

const options = { now: NOW, ttl_hours: 48 };

describe('eventIdempotencyKey', () => {
  it('no incluye timestamp', () => {
    // Si lo incluyera, cada reintento del beacon contaría como una vista nueva e
    // inflaría el CTR.
    assert.equal(
      eventIdempotencyKey('recq_1', 'recommendation_viewed', 'prod_a'),
      'recq_1:recommendation_viewed:prod_a',
    );
  });
});

describe('classifyIncomingEvents — sin fila served', () => {
  it('rechaza todo el lote como unknown_request', () => {
    const { accepted, rejected } = classifyIncomingEvents(
      null,
      [
        { event: 'recommendation_viewed', product_id: 'prod_a' },
        { event: 'recommendation_clicked', product_id: 'prod_b' },
      ],
      options,
    );
    assert.deepEqual(accepted, []);
    assert.deepEqual(
      rejected.map((r) => r.reason),
      ['unknown_request', 'unknown_request'],
    );
  });
});

describe('classifyIncomingEvents — TTL', () => {
  it('rechaza cuando la respuesta original es más vieja que el TTL', () => {
    const old = served({ occurred_at: new Date('2026-07-20T12:00:00.000Z') });
    const { accepted, rejected } = classifyIncomingEvents(
      old,
      [{ event: 'recommendation_clicked', product_id: 'prod_a' }],
      options,
    );
    assert.deepEqual(accepted, []);
    assert.equal(rejected[0]?.reason, 'expired');
  });

  it('acepta justo dentro del TTL', () => {
    const borderline = served({
      occurred_at: new Date(NOW.getTime() - 48 * 3_600_000 + 1000),
    });
    const { accepted } = classifyIncomingEvents(
      borderline,
      [{ event: 'recommendation_clicked', product_id: 'prod_a' }],
      options,
    );
    assert.equal(accepted.length, 1);
  });
});

describe('classifyIncomingEvents — validación de producto', () => {
  it('rechaza un producto que no fue servido en ese request', () => {
    // Es la regla que sostiene el reporte: un request_id no puede atribuir productos
    // que no formaron parte de esa respuesta.
    const { accepted, rejected } = classifyIncomingEvents(
      served(),
      [{ event: 'recommendation_clicked', product_id: 'prod_intruso' }],
      options,
    );
    assert.deepEqual(accepted, []);
    assert.equal(rejected[0]?.reason, 'product_not_served');
  });

  it('rechaza un evento sin producto', () => {
    const { rejected } = classifyIncomingEvents(
      served(),
      [{ event: 'recommendation_viewed' }],
      options,
    );
    assert.equal(rejected[0]?.reason, 'product_not_served');
  });

  it('rechaza cuando served_product_ids es null', () => {
    const { rejected } = classifyIncomingEvents(
      served({ served_product_ids: null }),
      [{ event: 'recommendation_viewed', product_id: 'prod_a' }],
      options,
    );
    assert.equal(rejected[0]?.reason, 'product_not_served');
  });
});

describe('classifyIncomingEvents — eventos del servidor', () => {
  it('rechaza served y purchased enviados por el cliente', () => {
    // Aceptar `purchased` del cliente permitiría inventar compras y revenue.
    const { accepted, rejected } = classifyIncomingEvents(
      served(),
      [
        { event: 'recommendation_served', product_id: 'prod_a' },
        { event: 'recommendation_purchased', product_id: 'prod_a' },
      ],
      options,
    );
    assert.deepEqual(accepted, []);
    assert.deepEqual(
      rejected.map((r) => r.reason),
      ['server_owned', 'server_owned'],
    );
  });

  it('rechaza un tipo de evento inventado', () => {
    const { rejected } = classifyIncomingEvents(
      served(),
      [{ event: 'recommendation_teleported', product_id: 'prod_a' }],
      options,
    );
    assert.equal(rejected[0]?.reason, 'server_owned');
  });
});

describe('classifyIncomingEvents — dimensiones', () => {
  it('copia TODAS las dimensiones de la fila served', () => {
    const row = served();
    const { accepted } = classifyIncomingEvents(
      row,
      [{ event: 'recommendation_clicked', product_id: 'prod_a', position: 2 }],
      options,
    );
    const event = accepted[0];
    assert.ok(event);
    assert.equal(event.placement, row.placement);
    assert.equal(event.strategy_key, row.strategy_key);
    assert.equal(event.resolved_strategy_key, row.resolved_strategy_key);
    assert.equal(event.fallback_used, true);
    assert.equal(event.version_id, row.version_id);
    assert.equal(event.source_product_id, row.source_product_id);
    assert.equal(event.cart_id, row.cart_id);
    assert.equal(event.customer_id, row.customer_id);
    assert.equal(event.session_id, row.session_id);
    assert.equal(event.sales_channel_id, row.sales_channel_id);
    assert.equal(event.region_id, row.region_id);
    assert.equal(event.currency_code, row.currency_code);
    assert.equal(event.position, 2);
  });

  it('ignora dimensiones inyectadas en el body', () => {
    // El cliente informa QUÉ pasó y sobre cuál producto; el contexto lo pone el
    // servidor. Sin esto se podría atribuir un clic a un placement que nunca sirvió
    // ese producto.
    const { accepted } = classifyIncomingEvents(
      served(),
      [
        {
          event: 'recommendation_clicked',
          product_id: 'prod_a',
          // @ts-expect-error: el tipo no las admite; el test prueba que se ignoran.
          placement: 'cart-recommendations',
          strategy_key: 'popular',
          cart_id: 'cart_ajeno',
        },
      ],
      options,
    );
    assert.equal(accepted[0]?.placement, 'product-detail-fbt');
    assert.equal(accepted[0]?.strategy_key, 'frequently_bought_together');
    assert.equal(accepted[0]?.cart_id, 'cart_1');
  });
});

describe('classifyIncomingEvents — deduplicación y tiempos', () => {
  it('deduplica dentro del lote', () => {
    const { accepted, rejected } = classifyIncomingEvents(
      served(),
      [
        { event: 'recommendation_viewed', product_id: 'prod_a' },
        { event: 'recommendation_viewed', product_id: 'prod_a' },
      ],
      options,
    );
    assert.equal(accepted.length, 1);
    assert.equal(rejected[0]?.reason, 'duplicate_in_batch');
  });

  it('no confunde eventos distintos del mismo producto', () => {
    const { accepted } = classifyIncomingEvents(
      served(),
      [
        { event: 'recommendation_viewed', product_id: 'prod_a' },
        { event: 'recommendation_clicked', product_id: 'prod_a' },
        { event: 'recommendation_added_to_cart', product_id: 'prod_a' },
      ],
      options,
    );
    assert.equal(accepted.length, 3);
    assert.equal(new Set(accepted.map((e) => e.idempotency_key)).size, 3);
  });

  it('usa el occurred_at del cliente si es válido y pasado', () => {
    const clientTime = '2026-07-24T11:59:30.000Z';
    const { accepted } = classifyIncomingEvents(
      served(),
      [{ event: 'recommendation_clicked', product_id: 'prod_a', occurred_at: clientTime }],
      options,
    );
    assert.equal(accepted[0]?.occurred_at.toISOString(), clientTime);
  });

  it('recorta un occurred_at futuro al ahora del servidor', () => {
    // Un reloj de cliente desfasado (o manipulado) arruinaría el bucketing horario.
    const { accepted } = classifyIncomingEvents(
      served(),
      [
        {
          event: 'recommendation_clicked',
          product_id: 'prod_a',
          occurred_at: '2027-01-01T00:00:00.000Z',
        },
      ],
      options,
    );
    assert.equal(accepted[0]?.occurred_at.getTime(), NOW.getTime());
  });

  it('cae al ahora del servidor ante un occurred_at basura', () => {
    const { accepted } = classifyIncomingEvents(
      served(),
      [{ event: 'recommendation_clicked', product_id: 'prod_a', occurred_at: 'no-es-fecha' }],
      options,
    );
    assert.equal(accepted[0]?.occurred_at.getTime(), NOW.getTime());
  });

  it('procesa un lote mixto aceptando lo válido', () => {
    const { accepted, rejected } = classifyIncomingEvents(
      served(),
      [
        { event: 'recommendation_viewed', product_id: 'prod_a' },
        { event: 'recommendation_viewed', product_id: 'prod_intruso' },
        { event: 'recommendation_clicked', product_id: 'prod_b' },
        { event: 'recommendation_purchased', product_id: 'prod_a' },
      ],
      options,
    );
    assert.deepEqual(
      accepted.map((e) => `${e.event}:${e.product_id}`),
      ['recommendation_viewed:prod_a', 'recommendation_clicked:prod_b'],
    );
    assert.deepEqual(
      rejected.map((r) => r.reason),
      ['product_not_served', 'server_owned'],
    );
  });

  it('con lote vacío no acepta ni rechaza nada', () => {
    assert.deepEqual(classifyIncomingEvents(served(), [], options), { accepted: [], rejected: [] });
  });
});
