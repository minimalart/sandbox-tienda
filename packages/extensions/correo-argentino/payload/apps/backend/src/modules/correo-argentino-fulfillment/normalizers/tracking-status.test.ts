import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORREO_KNOWN_STATUS_CODES,
  mapBucketToDeliveryStatus,
  mapBucketToEventCode,
  normalizeCorreoTrackingItem,
  normalizeCorreoTrackingStatus,
  parseCorreoEventDate,
  type CorreoTrackingBucket,
} from './tracking-status.ts';

const collectErrors = () => {
  const errors: string[] = [];
  return { logger: { error: (message: string) => errors.push(message) }, errors };
};

describe('normalizeCorreoTrackingStatus — los 3 códigos verificados', () => {
  // Son los ÚNICOS statusId documentados en ninguna fuente pública.
  it('PRE (preImposición) no avanza la state machine', () => {
    const result = normalizeCorreoTrackingStatus({
      statusId: 'PRE',
      status: 'preImposicion',
    });
    assert.equal(result.bucket, 'pre_shipment');
    // Correo todavía NO recibió el paquete: mapearlo a picked_up avanzaría la
    // ejecución sobre un envío que el carrier no tiene.
    assert.equal(result.status, null);
    assert.equal(result.code, 'created');
  });

  it('CAU (caduco) → failed', () => {
    const result = normalizeCorreoTrackingStatus({
      statusId: 'CAU',
      status: 'caduco',
    });
    assert.equal(result.bucket, 'failed');
    assert.equal(result.status, 'failed_attempt');
    assert.equal(result.code, 'failed_attempt');
  });

  it('CAN (en proceso de cancelación) → canceled', () => {
    const result = normalizeCorreoTrackingStatus({
      statusId: 'CAN',
      status: 'EN PROCESO DE CANCELACION',
    });
    assert.equal(result.bucket, 'canceled');
    assert.equal(result.status, 'canceled');
    assert.equal(result.code, 'canceled');
  });

  it('el código conocido manda sobre el texto', () => {
    // statusId conocido + texto que diría otra cosa: gana el código.
    const result = normalizeCorreoTrackingStatus({
      statusId: 'PRE',
      status: 'entregado',
    });
    assert.equal(result.bucket, 'pre_shipment');
  });

  it('el código matchea en minúsculas y con espacios', () => {
    assert.equal(
      normalizeCorreoTrackingStatus({ statusId: ' cau ' }).bucket,
      'failed',
    );
  });

  it('todos los códigos conocidos producen un bucket válido', () => {
    for (const [code, bucket] of Object.entries(CORREO_KNOWN_STATUS_CODES)) {
      assert.equal(normalizeCorreoTrackingStatus({ statusId: code }).bucket, bucket);
    }
  });
});

describe('normalizeCorreoTrackingStatus — matcher por texto', () => {
  const cases: Array<[string, CorreoTrackingBucket]> = [
    ['Pre imposición del envío', 'pre_shipment'],
    ['Imposición en sucursal', 'admitted'],
    ['ADMISION DE PIEZA', 'admitted'],
    ['En tránsito hacia destino', 'in_transit'],
    ['Despachado a planta', 'in_transit'],
    ['Arribo a planta de clasificación', 'in_transit'],
    ['CLOG - en proceso', 'in_transit'],
    ['En distribución', 'out_for_delivery'],
    ['Salió a reparto', 'out_for_delivery'],
    ['En camino al domicilio', 'out_for_delivery'],
    ['ENTREGADO AL DESTINATARIO', 'delivered'],
    ['Delivered', 'delivered'],
    ['Devolución al remitente', 'returned'],
    ['Returned to sender', 'returned'],
    ['Envío cancelado', 'canceled'],
    ['Plazo caducado', 'failed'],
    ['Entrega fallida', 'failed'],
    ['Rechazado por el destinatario', 'failed'],
  ];

  for (const [text, expected] of cases) {
    it(`"${text}" → ${expected}`, () => {
      assert.equal(
        normalizeCorreoTrackingStatus({ statusId: 'ZZZ', status: text }).bucket,
        expected,
      );
    });
  }

  it('"preimposicion" contiene "imposicion" y NO se clasifica como admitido', () => {
    // Si el orden de las reglas se invierte, todo pre-envío pasa a admitido.
    assert.equal(
      normalizeCorreoTrackingStatus({ status: 'PREIMPOSICION' }).bucket,
      'pre_shipment',
    );
    assert.equal(
      normalizeCorreoTrackingStatus({ status: 'IMPOSICION' }).bucket,
      'admitted',
    );
  });

  it('es insensible a acentos y mayúsculas', () => {
    assert.equal(
      normalizeCorreoTrackingStatus({ status: 'EN TRÁNSITO' }).bucket,
      'in_transit',
    );
    assert.equal(
      normalizeCorreoTrackingStatus({ status: 'en distribución' }).bucket,
      'out_for_delivery',
    );
  });

  it('también busca en el statusId cuando trae texto en vez de código', () => {
    assert.equal(
      normalizeCorreoTrackingStatus({ statusId: 'ENTREGADO' }).bucket,
      'delivered',
    );
  });
});

describe('normalizeCorreoTrackingStatus — bucket unknown', () => {
  it('sin match → unknown, sin status ni code', () => {
    const result = normalizeCorreoTrackingStatus({
      statusId: 'ZQ9',
      status: 'Algo que Correo nunca documentó',
    });
    assert.equal(result.bucket, 'unknown');
    assert.equal(result.status, null);
    assert.equal(result.code, null);
    assert.equal(result.raw_status_id, 'ZQ9');
    assert.equal(result.raw_status, 'Algo que Correo nunca documentó');
  });

  it('loguea el par statusId+status con logger.error (así se cosecha la tabla real)', () => {
    const { logger, errors } = collectErrors();
    normalizeCorreoTrackingStatus({ statusId: 'ZQ9', status: 'raro' }, logger);

    assert.equal(errors.length, 1);
    assert.match(errors[0] ?? '', /statusId="ZQ9"/);
    assert.match(errors[0] ?? '', /status="raro"/);
  });

  it('un evento vacío también cae en unknown y se loguea', () => {
    const { logger, errors } = collectErrors();
    const result = normalizeCorreoTrackingStatus({}, logger);
    assert.equal(result.bucket, 'unknown');
    assert.equal(result.raw_status_id, null);
    assert.equal(result.raw_status, null);
    assert.equal(errors.length, 1);
  });

  it('NO loguea cuando el evento sí se pudo clasificar', () => {
    const { logger, errors } = collectErrors();
    normalizeCorreoTrackingStatus({ statusId: 'PRE' }, logger);
    normalizeCorreoTrackingStatus({ status: 'entregado' }, logger);
    assert.equal(errors.length, 0);
  });
});

describe('mapBucketToDeliveryStatus / mapBucketToEventCode', () => {
  it('el vocabulario de salida es el del módulo delivery', () => {
    assert.equal(mapBucketToDeliveryStatus('admitted'), 'picked_up');
    assert.equal(mapBucketToDeliveryStatus('in_transit'), 'in_transit');
    assert.equal(mapBucketToDeliveryStatus('out_for_delivery'), 'in_transit');
    assert.equal(mapBucketToDeliveryStatus('delivered'), 'delivered');
    assert.equal(mapBucketToDeliveryStatus('canceled'), 'canceled');
    assert.equal(mapBucketToDeliveryStatus('failed'), 'failed_attempt');
    assert.equal(mapBucketToDeliveryStatus('pre_shipment'), null);
    assert.equal(mapBucketToDeliveryStatus('unknown'), null);
  });

  it('returned NO quema el estado terminal canceled', () => {
    assert.equal(mapBucketToDeliveryStatus('returned'), 'failed_attempt');
  });

  it('el code del timeline es más fino que el status de la máquina', () => {
    assert.equal(mapBucketToEventCode('pre_shipment'), 'created');
    assert.equal(mapBucketToEventCode('admitted'), 'admitted');
    assert.equal(mapBucketToEventCode('out_for_delivery'), 'in_transit');
    assert.equal(mapBucketToEventCode('unknown'), null);
  });
});

describe('parseCorreoEventDate — los DOS formatos del manual', () => {
  it('ISO con offset', () => {
    assert.equal(
      parseCorreoEventDate('2017-06-27T10:00:00-03:00'),
      '2017-06-27T13:00:00.000Z',
    );
  });

  it('DD-MM-YYYY HH:mm se interpreta en hora argentina', () => {
    assert.equal(
      parseCorreoEventDate('28-06-2022 11:53'),
      '2022-06-28T14:53:00.000Z',
    );
  });

  it('DD-MM-YYYY HH:mm:ss', () => {
    assert.equal(
      parseCorreoEventDate('28-06-2022 11:53:07'),
      '2022-06-28T14:53:07.000Z',
    );
  });

  it('valores ilegibles → null', () => {
    assert.equal(parseCorreoEventDate('no-es-fecha'), null);
    assert.equal(parseCorreoEventDate(''), null);
    assert.equal(parseCorreoEventDate(null), null);
    assert.equal(parseCorreoEventDate(undefined), null);
  });
});

describe('normalizeCorreoTrackingItem', () => {
  it('ordena los eventos cronológicamente y deriva el último estado mapeable', () => {
    const result = normalizeCorreoTrackingItem({
      trackingNumber: '11111111111',
      quantity: 3,
      serviceType: 'CP',
      event: [
        { statusId: 'ENT', status: 'Entregado', date: '28-06-2022 15:00' },
        { statusId: 'PRE', status: 'preImposicion', date: '27-06-2022 09:00' },
        { statusId: 'TRA', status: 'En transito', date: '28-06-2022 08:00' },
      ],
    });

    assert.equal(result.tracking_number, '11111111111');
    assert.equal(result.product_type, 'CP');
    assert.equal(result.has_history, true);
    assert.deepEqual(
      result.events.map((event) => event.bucket),
      ['pre_shipment', 'in_transit', 'delivered'],
    );
    assert.equal(result.latest?.bucket, 'delivered');
    assert.equal(result.status, 'delivered');
  });

  it('quantity 0 con event vacío significa "TN sin historial", no error', () => {
    const result = normalizeCorreoTrackingItem({
      trackingNumber: '22222222222',
      quantity: 0,
      event: [],
    });

    assert.equal(result.has_history, false);
    assert.deepEqual(result.events, []);
    assert.equal(result.latest, null);
    assert.equal(result.status, null);
  });

  it('acepta productType además de serviceType (el manual usa los dos)', () => {
    assert.equal(
      normalizeCorreoTrackingItem({ productType: 'EP', event: [] }).product_type,
      'EP',
    );
  });

  it('acepta facilityId y facilityCode (el manual usa los dos)', () => {
    const byId = normalizeCorreoTrackingItem({
      event: [{ statusId: 'PRE', facilityId: '1234', facility: 'CABA' }],
    });
    const byCode = normalizeCorreoTrackingItem({
      event: [{ statusId: 'PRE', facilityCode: '1234', facility: 'CABA' }],
    });

    assert.equal(byId.events[0]?.facility_code, '1234');
    assert.equal(byCode.events[0]?.facility_code, '1234');
    assert.equal(byId.events[0]?.facility, 'CABA');
  });

  it('un evento unknown al final no borra el progreso ya reportado', () => {
    const result = normalizeCorreoTrackingItem({
      event: [
        { statusId: 'TRA', status: 'En transito', date: '28-06-2022 08:00' },
        { statusId: 'ZQ9', status: 'sin documentar', date: '28-06-2022 09:00' },
      ],
    });

    assert.equal(result.latest?.bucket, 'unknown');
    assert.equal(result.status, 'in_transit');
  });

  it('los eventos sin fecha legible no desplazan al último fechado', () => {
    const result = normalizeCorreoTrackingItem({
      event: [
        { statusId: 'ENT', status: 'Entregado', date: '28-06-2022 15:00' },
        { statusId: 'PRE', status: 'preImposicion', date: 'basura' },
      ],
    });

    assert.equal(result.events[0]?.bucket, 'pre_shipment');
    assert.equal(result.latest?.bucket, 'delivered');
  });

  it('event ausente o no-array no rompe', () => {
    assert.equal(normalizeCorreoTrackingItem({}).has_history, false);
    assert.equal(
      normalizeCorreoTrackingItem({ event: 'nope' }).has_history,
      false,
    );
  });

  it('propaga el logger para que cada unknown quede registrado', () => {
    const { logger, errors } = collectErrors();
    normalizeCorreoTrackingItem(
      {
        event: [
          { statusId: 'ZQ1', status: 'a' },
          { statusId: 'ZQ2', status: 'b' },
          { statusId: 'PRE', status: 'preImposicion' },
        ],
      },
      logger,
    );
    assert.equal(errors.length, 2);
  });
});
