import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isGreeting, parseLeadingQuantity, planGreeting } from './router';
import { parseOrderDisplayId, parseEmail, formatOrderStatusForCustomer } from './order-lookup';
import { formatBusinessHours, buildMapUrl, formatStoreLocationsMessage } from './store-locations';

/**
 * Se testean las funciones PURAS del router y sus helpers. `routeInbound` en sí
 * necesita container + módulo + Kapso, así que se verifica end-to-end por WhatsApp;
 * lo que sí puede romperse en silencio es el parseo (cantidades, números de pedido,
 * emails) y el formateo de horarios, que es donde están los casos raros.
 */

describe('planGreeting', () => {
  test('sesión recién arrancada → menú', () => {
    assert.equal(planGreeting({ intent: null, step: null, answers: {} }), 'menu');
  });

  /**
   * El caso que dejó al bot MUDO en producción (2026-08-04): la sesión dura 12 h,
   * así que a mitad de un recorrido el saludo caía al modelo — y el modelo devolvió
   * vacío. Con una pregunta pendiente se retoma.
   */
  test('con pregunta pendiente → retoma, no cae al modelo', () => {
    assert.equal(
      planGreeting({
        intent: 'guided',
        step: 'advisor_question',
        answers: { surface: 'wall' },
        pending_dimension: 'environment',
      }),
      'resume_guided',
    );
  });

  /**
   * El estado real en el que quedó la conversación del 2026-08-04: el asesor
   * terminó en "no encontré productos" y dejó `step` y `pending_dimension` en null.
   * Retomar ahí rehace una búsqueda que YA dio cero y le contesta "no encontré
   * productos" a quien dijo "Hola".
   */
  test('recorrido terminado sin resultados → menú, no repetir el cero', () => {
    assert.equal(
      planGreeting({
        intent: 'guided',
        step: null,
        answers: { surface: 'wall' },
        pending_dimension: null,
      }),
      'menu',
    );
  });

  test('sesión de compra (no guiada) → menú', () => {
    assert.equal(planGreeting({ intent: 'buy', step: 'awaiting_search_query', answers: {} }), 'menu');
  });

  test('no hay tercera opción: un saludo SIEMPRE se responde', () => {
    for (const session of [
      { intent: null, step: 'advisor_question', answers: {} },
      { intent: 'guided', step: null, answers: {} },
      { intent: 'guided', pending_dimension: 'base', answers: { surface: 'wood' } },
      { intent: undefined, step: undefined, answers: undefined },
    ]) {
      assert.ok(['menu', 'resume_guided'].includes(planGreeting(session)));
    }
  });
});

describe('isGreeting', () => {
  test('reconoce los saludos de siempre', () => {
    for (const text of ['hola', 'holis', 'buenas', 'buen dia', 'buenas tardes', 'hey', 'que tal']) {
      assert.ok(isGreeting(text), text);
    }
  });

  test('no confunde palabras que empiezan igual', () => {
    // El `\b` es lo que evita que "holanda" abra el menú.
    for (const text of ['holanda', 'holandesa', 'buenaventura']) {
      assert.equal(isGreeting(text), false, text);
    }
  });

  test('un saludo con cola sigue siendo saludo', () => {
    assert.ok(isGreeting('hola! como andas'));
    assert.ok(isGreeting('buenas tardes, necesito pintura'));
  });
});

describe('parseLeadingQuantity', () => {
  test('toma la cantidad al principio', () => {
    assert.equal(parseLeadingQuantity('3 latas de latex'), 3);
    assert.equal(parseLeadingQuantity('2 albalatex'), 2);
    assert.equal(parseLeadingQuantity('10 rodillos'), 10);
  });

  test('acepta la forma con x', () => {
    assert.equal(parseLeadingQuantity('4x pincel'), 4);
    assert.equal(parseLeadingQuantity('4 x pincel'), 4);
  });

  test('ignora números que son parte del producto, no cantidad', () => {
    // Sin palabra después del número no es una cantidad.
    assert.equal(parseLeadingQuantity('20'), null);
    // El número va al principio o no cuenta: acá "20" es la presentación.
    assert.equal(parseLeadingQuantity('albalatex 20 litros'), null);
  });

  test('rechaza lo que no es cantidad razonable', () => {
    assert.equal(parseLeadingQuantity('0 latas'), null);
    assert.equal(parseLeadingQuantity('100 latas'), null); // 3 dígitos: no es cantidad
    assert.equal(parseLeadingQuantity(''), null);
    assert.equal(parseLeadingQuantity('hola'), null);
  });
});

describe('parseOrderDisplayId', () => {
  test('lee el número con y sin ruido alrededor', () => {
    assert.equal(parseOrderDisplayId('1234'), 1234);
    assert.equal(parseOrderDisplayId('#1234'), 1234);
    assert.equal(parseOrderDisplayId('el pedido 1234'), 1234);
    assert.equal(parseOrderDisplayId('pedido nro 87'), 87);
  });

  test('null cuando no hay número', () => {
    assert.equal(parseOrderDisplayId('no me acuerdo'), null);
    assert.equal(parseOrderDisplayId(''), null);
  });
});

describe('parseEmail', () => {
  test('extrae el email del texto', () => {
    assert.equal(parseEmail('mi mail es Juan@Mail.com'), 'juan@mail.com');
    assert.equal(parseEmail('  ana.perez@empresa.com.ar '), 'ana.perez@empresa.com.ar');
  });

  test('null cuando no hay email válido', () => {
    assert.equal(parseEmail('juan arroba mail'), null);
    assert.equal(parseEmail('sin arroba.com'), null);
    assert.equal(parseEmail(''), null);
  });
});

describe('formatBusinessHours', () => {
  const weekday = { closed: false, is24Hours: false, slots: [{ open: '08:00', close: '18:00' }] };
  const saturday = { closed: false, is24Hours: false, slots: [{ open: '09:00', close: '13:00' }] };
  const closed = { closed: true, is24Hours: false, slots: [] };

  test('agrupa los días consecutivos con el mismo horario', () => {
    const lines = formatBusinessHours({
      monday: weekday, tuesday: weekday, wednesday: weekday, thursday: weekday, friday: weekday,
      saturday, sunday: closed,
    });
    assert.deepEqual(lines, ['Lunes a Viernes: 08:00 a 18:00', 'Sábado: 09:00 a 13:00']);
  });

  test('omite los días cerrados', () => {
    const lines = formatBusinessHours({ monday: weekday, sunday: closed });
    assert.deepEqual(lines, ['Lunes: 08:00 a 18:00']);
  });

  test('soporta doble turno y 24 h', () => {
    const split = {
      closed: false,
      is24Hours: false,
      slots: [{ open: '08:00', close: '12:00' }, { open: '16:00', close: '20:00' }],
    };
    assert.deepEqual(formatBusinessHours({ monday: split }), ['Lunes: 08:00 a 12:00 y 16:00 a 20:00']);
    assert.deepEqual(formatBusinessHours({ monday: { is24Hours: true, closed: false, slots: [] } }), [
      'Lunes: 24 h',
    ]);
  });

  test('no revienta con datos ausentes o basura', () => {
    assert.deepEqual(formatBusinessHours(null), []);
    assert.deepEqual(formatBusinessHours('cerrado'), []);
    assert.deepEqual(formatBusinessHours({}), []);
  });
});

describe('buildMapUrl', () => {
  test('prefiere las coordenadas guardadas', () => {
    const url = buildMapUrl({ lat: '-41.13', lng: '-71.31', street: 'Mitre 100' });
    assert.ok(url?.includes('-41.13%2C-71.31'), url ?? '(null)');
  });

  test('cae a la dirección cuando no hay coordenadas', () => {
    const url = buildMapUrl({ street: 'Mitre 100', city: 'Bariloche', province: 'Río Negro' });
    assert.ok(url?.includes('Mitre'), url ?? '(null)');
  });

  test('null cuando no hay nada con qué armarlo', () => {
    assert.equal(buildMapUrl({}), null);
  });
});

describe('formatStoreLocationsMessage', () => {
  test('sin sucursales cargadas ofrece derivar, no miente', () => {
    const msg = formatStoreLocationsMessage([]);
    assert.match(msg, /no tengo las sucursales cargadas/i);
  });

  test('arma un bloque por sucursal con horarios y mapa', () => {
    const msg = formatStoreLocationsMessage([
      {
        name: 'Casa central',
        address: 'Mitre 100, Bariloche',
        phone: '294 4123456',
        whatsapp: null,
        hours: ['Lunes a Viernes: 08:00 a 18:00'],
        map_url: 'https://maps.example/x',
      },
    ]);
    assert.match(msg, /Casa central/);
    assert.match(msg, /Mitre 100/);
    assert.match(msg, /08:00 a 18:00/);
    assert.match(msg, /maps\.example/);
  });
});

describe('formatOrderStatusForCustomer', () => {
  const base = {
    display_id: 1234,
    status: 'completed',
    payment_status: 'captured',
    fulfillment_status: 'shipped',
    created_at: '2026-08-01T10:00:00.000Z',
    total: '12.345,00',
    currency_code: 'ARS',
    shipping_method: 'Andreani a domicilio',
    tracking: [{ number: 'AR123', url: 'https://track/AR123' }],
    shipped_at: '2026-08-02T10:00:00.000Z',
    delivered_at: null,
  };

  test('traduce los estados de Medusa a castellano', () => {
    const msg = formatOrderStatusForCustomer(base);
    assert.match(msg, /Pedido #1234/);
    assert.match(msg, /Pago: pagado/);
    assert.match(msg, /Preparación: despachado/);
    assert.match(msg, /Ya salió para entrega/);
    assert.match(msg, /AR123/);
  });

  test('entregado gana sobre despachado', () => {
    const msg = formatOrderStatusForCustomer({ ...base, delivered_at: '2026-08-03T10:00:00.000Z' });
    assert.match(msg, /Ya fue entregado/);
    assert.doesNotMatch(msg, /salió para entrega/);
  });

  test('no inventa campos que no vinieron', () => {
    const msg = formatOrderStatusForCustomer({
      ...base,
      payment_status: null,
      fulfillment_status: null,
      shipping_method: null,
      total: null,
      tracking: [],
      shipped_at: null,
    });
    assert.equal(msg, '*Pedido #1234*');
  });
});
