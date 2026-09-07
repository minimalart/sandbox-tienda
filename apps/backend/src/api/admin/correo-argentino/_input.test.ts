import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LABELS,
  MAX_ORDERS,
  dedupeAndCap,
  parseFulfillmentQuery,
  parseOptionalBoolean,
  parseOrderIds,
  parsePagination,
  parseString,
  parseTrackingNumbers,
} from './_input';

describe('dedupeAndCap', () => {
  it('deduplica conservando el primer orden', () => {
    const result = dedupeAndCap(['a', 'b', 'a', 'c', 'b'], 10);
    assert.deepEqual(result.items, ['a', 'b', 'c']);
    assert.equal(result.requested, 3);
    assert.equal(result.truncated, false);
  });

  it('trimea y descarta vacíos y no-strings', () => {
    const result = dedupeAndCap([' a ', '', '   ', 42, null, undefined, 'b'], 10);
    assert.deepEqual(result.items, ['a', 'b']);
  });

  it('la dedupe corre DESPUÉS del trim', () => {
    // Sin esto, `"a"` y `" a "` serían dos envíos facturables del mismo pedido.
    assert.deepEqual(dedupeAndCap(['a', ' a', 'a '], 10).items, ['a']);
  });

  it('devuelve lista vacía para entradas que no son array', () => {
    for (const input of [undefined, null, 'a', 42, {}]) {
      assert.deepEqual(dedupeAndCap(input, 10).items, []);
    }
  });

  it('corta al cap y reporta requested sin truncar', () => {
    const result = dedupeAndCap(['a', 'b', 'c', 'd'], 2);
    assert.deepEqual(result.items, ['a', 'b']);
    // `requested` es lo que el operador pidió: es lo que va al warning y al
    // summary. Si acá se reportara 2, el truncado sería invisible.
    assert.equal(result.requested, 4);
    assert.equal(result.truncated, true);
  });

  it('exactamente el cap NO cuenta como truncado', () => {
    const result = dedupeAndCap(['a', 'b'], 2);
    assert.equal(result.truncated, false);
    assert.equal(result.items.length, 2);
  });
});

describe('parseOrderIds — corte por MAX_ORDERS', () => {
  it('MAX_ORDERS es 50', () => {
    assert.equal(MAX_ORDERS, 50);
  });

  it('50 órdenes pasan enteras', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `order_${i}`);
    const result = parseOrderIds({ order_ids: ids });
    assert.equal(result.items.length, 50);
    assert.equal(result.truncated, false);
  });

  it('62 órdenes se cortan a 50 y avisan que 62 se pidieron', () => {
    const ids = Array.from({ length: 62 }, (_, i) => `order_${i}`);
    const result = parseOrderIds({ order_ids: ids });
    assert.equal(result.items.length, 50);
    assert.equal(result.requested, 62);
    assert.equal(result.truncated, true);
    // Se procesan las PRIMERAS, no una muestra al azar.
    assert.equal(result.items[0], 'order_0');
    assert.equal(result.items[49], 'order_49');
  });

  it('los duplicados se cuentan una sola vez contra el cap', () => {
    // 60 entradas pero solo 30 órdenes distintas: nada se trunca.
    const ids = Array.from({ length: 30 }, (_, i) => `order_${i}`);
    const result = parseOrderIds({ order_ids: [...ids, ...ids] });
    assert.equal(result.items.length, 30);
    assert.equal(result.truncated, false);
  });

  it('body vacío o sin order_ids da lista vacía (la ruta responde 400)', () => {
    assert.deepEqual(parseOrderIds({}).items, []);
    assert.deepEqual(parseOrderIds(undefined).items, []);
    assert.deepEqual(parseOrderIds({ order_ids: 'order_1' }).items, []);
  });
});

describe('parseTrackingNumbers — corte por MAX_LABELS', () => {
  it('MAX_LABELS es 200 y es mayor que MAX_ORDERS', () => {
    assert.equal(MAX_LABELS, 200);
    // Bajar rótulos no crea nada facturable: el cap puede ser más alto.
    assert.ok(MAX_LABELS > MAX_ORDERS);
  });

  it('corta a 200', () => {
    const tns = Array.from({ length: 250 }, (_, i) => `TN${i}`);
    const result = parseTrackingNumbers({ tracking_numbers: tns });
    assert.equal(result.items.length, 200);
    assert.equal(result.requested, 250);
    assert.equal(result.truncated, true);
  });
});

describe('parseOptionalBoolean', () => {
  it('acepta booleanos nativos', () => {
    assert.equal(parseOptionalBoolean(true), true);
    assert.equal(parseOptionalBoolean(false), false);
  });

  it('acepta las grafías de string de un query param', () => {
    assert.equal(parseOptionalBoolean('true'), true);
    assert.equal(parseOptionalBoolean('TRUE'), true);
    assert.equal(parseOptionalBoolean(' true '), true);
    assert.equal(parseOptionalBoolean('1'), true);
    assert.equal(parseOptionalBoolean('false'), false);
    assert.equal(parseOptionalBoolean('0'), false);
  });

  it('lo ausente o ambiguo es undefined, NUNCA false', () => {
    // La distinción importa para los filtros de sucursal: `false` significa
    // "dame las que NO reciben paquetes", el opuesto de "no filtres".
    for (const input of [undefined, null, '', 'quizás', 42, {}]) {
      assert.equal(parseOptionalBoolean(input), undefined);
    }
  });

  it('un force ambiguo no fuerza (=== true en la ruta)', () => {
    assert.notEqual(parseOptionalBoolean('quizás'), true);
    assert.notEqual(parseOptionalBoolean(undefined), true);
  });
});

describe('parseString', () => {
  it('trimea strings y devuelve "" para el resto', () => {
    assert.equal(parseString('  hola '), 'hola');
    assert.equal(parseString(''), '');
    assert.equal(parseString(undefined), '');
    assert.equal(parseString(42), '');
    assert.equal(parseString(['a']), '');
  });
});

describe('parsePagination', () => {
  it('usa los defaults cuando no viene nada', () => {
    assert.deepEqual(parsePagination({}), { limit: 20, offset: 0 });
    assert.deepEqual(parsePagination(undefined), { limit: 20, offset: 0 });
  });

  it('un limit no numérico cae al default en vez de propagar NaN', () => {
    // `slice(NaN, NaN)` devuelve array VACÍO sin error: el admin vería una tabla
    // vacía y creería que no hay envíos.
    assert.deepEqual(parsePagination({ limit: 'abc' }), { limit: 20, offset: 0 });
    assert.deepEqual(parsePagination({ offset: 'abc' }), { limit: 20, offset: 0 });
  });

  it('clampea el limit al máximo', () => {
    assert.equal(parsePagination({ limit: '5000' }).limit, 100);
    assert.equal(parsePagination({ limit: '50' }).limit, 50);
  });

  it('un limit de 0 o negativo cae al default, no a 0', () => {
    // Un limit 0 sería una tabla vacía indistinguible de "no hay datos".
    assert.equal(parsePagination({ limit: '0' }).limit, 20);
    assert.equal(parsePagination({ limit: '-5' }).limit, 20);
  });

  it('un offset negativo se normaliza a 0', () => {
    // `slice(-5)` cuenta desde el FINAL: daría la última página en silencio.
    assert.equal(parsePagination({ offset: '-5' }).offset, 0);
  });

  it('trunca decimales', () => {
    assert.deepEqual(parsePagination({ limit: '10.7', offset: '3.9' }), {
      limit: 10,
      offset: 3,
    });
  });

  it('respeta defaults custom', () => {
    assert.deepEqual(parsePagination({ limit: '500' }, { limit: 5, maxLimit: 10 }), {
      limit: 10,
      offset: 0,
    });
  });
});

describe('parseFulfillmentQuery', () => {
  it('trimea todos los filtros de texto', () => {
    assert.deepEqual(
      parseFulfillmentQuery({
        search: '  TN123 ',
        status: ' shipped ',
        date_from: ' 2026-01-01 ',
        date_to: ' 2026-01-31 ',
      }),
      {
        search: 'TN123',
        status: 'shipped',
        date_from: '2026-01-01',
        date_to: '2026-01-31',
        ticketed_only: false,
      }
    );
  });

  it('ticketed_only es booleano duro: solo "true" lo activa', () => {
    assert.equal(parseFulfillmentQuery({ ticketed_only: 'true' }).ticketed_only, true);
    assert.equal(parseFulfillmentQuery({ ticketed_only: true }).ticketed_only, true);
    assert.equal(parseFulfillmentQuery({ ticketed_only: 'false' }).ticketed_only, false);
    // En ESTE listado "no lo mandaste" y "false" significan lo mismo.
    assert.equal(parseFulfillmentQuery({}).ticketed_only, false);
    assert.equal(parseFulfillmentQuery({ ticketed_only: 'sí' }).ticketed_only, false);
  });

  it('un body/query vacío da todos los filtros neutros', () => {
    assert.deepEqual(parseFulfillmentQuery(undefined), {
      search: '',
      status: '',
      date_from: '',
      date_to: '',
      ticketed_only: false,
    });
  });
});
