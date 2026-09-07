import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyAttribution, groupTimelineByProduct, type TimelineEvent } from './attribution';

const at = (seconds: number) => new Date(`2026-07-24T12:00:${String(seconds).padStart(2, '0')}.000Z`);

const event = (
  name: string,
  seconds: number,
  overrides: Partial<TimelineEvent> = {},
): TimelineEvent => ({
  event: name,
  product_id: 'prod_a',
  occurred_at: at(seconds),
  placement: 'product-detail-fbt',
  strategy_key: 'frequently_bought_together',
  resolved_strategy_key: 'manual',
  version_id: 'recver_1',
  request_id: 'recq_1',
  ...overrides,
});

describe('classifyAttribution — directa', () => {
  it('clic antes del agregado es atribución directa', () => {
    const result = classifyAttribution([
      event('recommendation_viewed', 1),
      event('recommendation_clicked', 2),
      event('recommendation_added_to_cart', 3),
    ]);
    assert.equal(result.attribution, 'direct');
  });

  it('acepta clic y agregado en el mismo instante', () => {
    // El agregado suele dispararse en el mismo gesto que el clic: con `<` estricto
    // toda la atribución directa se perdería.
    const result = classifyAttribution([
      event('recommendation_clicked', 5),
      event('recommendation_added_to_cart', 5),
    ]);
    assert.equal(result.attribution, 'direct');
  });

  it('un clic POSTERIOR al agregado no es directa', () => {
    // El usuario agregó el producto desde otro lado y después clickeó: no hay
    // causalidad, es influencia.
    const result = classifyAttribution([
      event('recommendation_added_to_cart', 2),
      event('recommendation_clicked', 5),
    ]);
    assert.equal(result.attribution, 'assisted');
  });

  it('exige que el clic y el agregado sean del MISMO request', () => {
    // Un clic en un rail y un agregado en otro son dos interacciones distintas.
    const result = classifyAttribution([
      event('recommendation_clicked', 2, { request_id: 'recq_rail_a' }),
      event('recommendation_added_to_cart', 3, { request_id: 'recq_rail_b' }),
    ]);
    assert.equal(result.attribution, 'assisted');
  });
});

describe('classifyAttribution — asistida', () => {
  it('sólo vista es asistida', () => {
    assert.equal(classifyAttribution([event('recommendation_viewed', 1)]).attribution, 'assisted');
  });

  it('el served cuenta como vista para asistida', () => {
    assert.equal(classifyAttribution([event('recommendation_served', 1)]).attribution, 'assisted');
  });

  it('clic sin agregado es asistida', () => {
    assert.equal(classifyAttribution([event('recommendation_clicked', 1)]).attribution, 'assisted');
  });

  it('agregado sin clic previo es asistida', () => {
    assert.equal(
      classifyAttribution([event('recommendation_added_to_cart', 1)]).attribution,
      'assisted',
    );
  });
});

describe('classifyAttribution — sin atribución', () => {
  it('timeline vacío no atribuye', () => {
    assert.deepEqual(classifyAttribution([]), {
      attribution: 'none',
      placement: null,
      strategy_key: null,
      resolved_strategy_key: null,
      version_id: null,
      request_id: null,
    });
  });

  it('eventos irrelevantes no atribuyen', () => {
    assert.equal(classifyAttribution([event('recommendation_purchased', 1)]).attribution, 'none');
  });
});

describe('classifyAttribution — dimensiones', () => {
  it('el crédito va al evento más específico', () => {
    // El agregado gana sobre el clic y el clic sobre la vista, así el crédito queda en
    // el widget que efectivamente convirtió.
    const result = classifyAttribution([
      event('recommendation_viewed', 1, { placement: 'cart-recommendations', request_id: 'recq_x' }),
      event('recommendation_clicked', 2, { placement: 'product-detail-similar', request_id: 'recq_y' }),
      event('recommendation_added_to_cart', 3, {
        placement: 'product-detail-fbt',
        request_id: 'recq_y',
      }),
    ]);
    assert.equal(result.attribution, 'direct');
    assert.equal(result.placement, 'product-detail-fbt');
  });

  it('en asistida el crédito va al agregado si existe, si no al clic, si no a la vista', () => {
    assert.equal(
      classifyAttribution([
        event('recommendation_viewed', 1, { placement: 'vista' }),
        event('recommendation_clicked', 2, { placement: 'clic' }),
      ]).placement,
      'clic',
    );
    assert.equal(
      classifyAttribution([event('recommendation_viewed', 1, { placement: 'vista' })]).placement,
      'vista',
    );
  });

  it('conserva el request_id para poder reconstruir la recomendación original', () => {
    const result = classifyAttribution([
      event('recommendation_clicked', 2, { request_id: 'recq_origen' }),
      event('recommendation_added_to_cart', 3, { request_id: 'recq_origen' }),
    ]);
    assert.equal(result.request_id, 'recq_origen');
    assert.equal(result.version_id, 'recver_1');
  });
});

describe('groupTimelineByProduct', () => {
  it('agrupa por producto y ordena cronológicamente', () => {
    const grouped = groupTimelineByProduct([
      event('recommendation_added_to_cart', 9, { product_id: 'prod_a' }),
      event('recommendation_clicked', 3, { product_id: 'prod_a' }),
      event('recommendation_viewed', 1, { product_id: 'prod_b' }),
    ]);
    assert.deepEqual([...grouped.keys()].sort(), ['prod_a', 'prod_b']);
    assert.deepEqual(
      grouped.get('prod_a')?.map((e) => e.event),
      ['recommendation_clicked', 'recommendation_added_to_cart'],
    );
  });

  it('descarta eventos sin producto (la fila served no tiene product_id)', () => {
    const grouped = groupTimelineByProduct([
      event('recommendation_served', 1, { product_id: null }),
      event('recommendation_viewed', 2, { product_id: 'prod_a' }),
    ]);
    assert.equal(grouped.size, 1);
  });

  it('clasifica correctamente después de agrupar un timeline desordenado', () => {
    const grouped = groupTimelineByProduct([
      event('recommendation_added_to_cart', 5),
      event('recommendation_clicked', 2),
    ]);
    assert.equal(classifyAttribution(grouped.get('prod_a') ?? []).attribution, 'direct');
  });
});
