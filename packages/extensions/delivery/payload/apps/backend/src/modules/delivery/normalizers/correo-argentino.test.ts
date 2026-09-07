/**
 * Piezas que sostienen el sync de Correo: el batcheo (la ventaja concreta sobre
 * Andreani) y la proyección del normalizador al contrato del adapter.
 *
 * El mapeo `statusId` → estado NO se testea acá: tiene sus propios tests en
 * `correo-argentino-fulfillment/normalizers/tracking-status.test.ts`. Lo que se
 * pinea acá es que esta capa no lo distorsione — en particular que `pre_shipment`
 * siga proyectando a `status: null` y que `returned` no se vuelva terminal.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CorreoRawTrackingItem } from '../../correo-argentino-fulfillment/types.ts';
import {
  CORREO_TRACKING_BATCH_SIZE,
  chunkCorreoTrackingNumbers,
  correoTrackingKey,
  hasCorreoCarrierToken,
  pollCorreoTrackingBatched,
  toCorreoStatusUpdate,
} from './correo-argentino.ts';

const item = (
  trackingNumber: string,
  events: Array<{ statusId?: string; status?: string; date?: string }>,
): CorreoRawTrackingItem => ({
  trackingNumber,
  quantity: events.length,
  event: events,
});

describe('hasCorreoCarrierToken', () => {
  it('acepta las tres grafías que escriben provider, storefront y workflow', () => {
    for (const value of [
      'correo-argentino',
      'correo_argentino',
      'correo argentino',
      'Correo Argentino',
      'CORREO-ARGENTINO',
      'correo',
    ]) {
      assert.equal(hasCorreoCarrierToken(value), true, value);
    }
  });

  // Es la señal EXPLÍCITA: un match parcial acá clasificaría envíos ajenos.
  it('rechaza otros carriers y coincidencias parciales', () => {
    for (const value of [
      'andreani',
      'oca',
      'correos-de-chile',
      'correo-privado-x',
      'micorreo',
      '',
      undefined,
    ]) {
      assert.equal(hasCorreoCarrierToken(value), false, String(value));
    }
  });
});

describe('chunkCorreoTrackingNumbers', () => {
  it('agrupa de a CORREO_TRACKING_BATCH_SIZE', () => {
    const tns = Array.from({ length: 60 }, (_, i) => `MER${i}`);
    const batches = chunkCorreoTrackingNumbers(tns);
    assert.equal(batches.length, Math.ceil(60 / CORREO_TRACKING_BATCH_SIZE));
    assert.equal(batches[0]?.length, CORREO_TRACKING_BATCH_SIZE);
    assert.equal(
      batches.flat().length,
      60,
      'no se puede perder ningún TN al partir',
    );
  });

  // Dos ejecuciones de la misma orden comparten TN: pedirlo dos veces es gastar
  // cuota del gateway al vacío.
  it('deduplica (case-insensitive) y descarta vacíos/nulos', () => {
    const batches = chunkCorreoTrackingNumbers(
      ['MER1', 'mer1', ' MER1 ', '', '   ', null, undefined, 'MER2'],
      10,
    );
    assert.deepEqual(batches, [['MER1', 'MER2']]);
  });

  it('lista vacía → ningún lote (no un lote vacío)', () => {
    assert.deepEqual(chunkCorreoTrackingNumbers([]), []);
    assert.deepEqual(chunkCorreoTrackingNumbers([null, '']), []);
  });

  it('un batchSize inválido no produce un loop infinito', () => {
    assert.deepEqual(chunkCorreoTrackingNumbers(['A', 'B'], 0), [['A'], ['B']]);
    assert.deepEqual(chunkCorreoTrackingNumbers(['A', 'B'], -5), [['A'], ['B']]);
  });
});

describe('toCorreoStatusUpdate', () => {
  it('entregado → delivered, con los eventos del timeline', () => {
    const update = toCorreoStatusUpdate(
      item('MER1', [
        { statusId: 'PRE', status: 'PREIMPOSICION', date: '01-08-2026 10:00' },
        { statusId: 'ENT', status: 'ENTREGADO', date: '03-08-2026 11:30' },
      ]),
    );
    assert.equal(update.status, 'delivered');
    assert.equal(update.events?.length, 2);
  });

  // ⚠️ Regresión del contrato del normalizador: preImposición significa que
  // Correo TODAVÍA NO tiene el paquete. Avanzar la máquina acá sería mentir.
  it('solo preImposición → status null (Correo no tiene el paquete)', () => {
    const update = toCorreoStatusUpdate(
      item('MER1', [{ statusId: 'PRE', status: 'PREIMPOSICION' }]),
    );
    assert.equal(update.status, null);
  });

  // ⚠️ `canceled` es TERMINAL (DELIVERY_TRANSITIONS → []). Una devolución no
  // puede quemar el terminal: queda en failed_attempt, que sigue teniendo salida.
  it('devolución → failed_attempt, NO canceled', () => {
    const update = toCorreoStatusUpdate(
      item('MER1', [{ status: 'EN DEVOLUCION AL REMITENTE', date: '03-08-2026 09:00' }]),
    );
    assert.equal(update.status, 'failed_attempt');
  });

  it('`event: []` con HTTP 200 (TN inexistente o recién creado) → status null', () => {
    const update = toCorreoStatusUpdate({ id: null, quantity: 0, event: [] });
    assert.equal(update.status, null);
    assert.equal(update.events, undefined);
  });
});

describe('pollCorreoTrackingBatched', () => {
  it('hace UNA llamada por lote, no una por envío', async () => {
    const tns = Array.from({ length: 60 }, (_, i) => `MER${i}`);
    const calls: string[][] = [];

    await pollCorreoTrackingBatched(
      tns,
      async (batch) => {
        calls.push(batch);
        return batch.map((tn) => item(tn, [{ status: 'EN TRANSITO' }]));
      },
      { batchSize: 25 },
    );

    assert.equal(calls.length, 3, '60 TNs con lotes de 25 son 3 llamadas');
    assert.notEqual(calls.length, tns.length, 'no una llamada por envío');
    assert.deepEqual(
      calls.map((batch) => batch.length),
      [25, 25, 10],
    );
  });

  it('indexa por tracking number normalizado, no por posición', async () => {
    const index = await pollCorreoTrackingBatched(
      ['mer1', 'MER2'],
      async () => [
        // Respuesta DESORDENADA y con distinta caja: si el match fuera posicional
        // MER1 se llevaría el estado de MER2.
        item('MER2', [{ status: 'ENTREGADO' }]),
        item('mer1', [{ status: 'EN TRANSITO' }]),
      ],
      { batchSize: 10 },
    );

    assert.equal(index.get(correoTrackingKey('MER1'))?.status, 'in_transit');
    assert.equal(index.get(correoTrackingKey('MER2'))?.status, 'delivered');
  });

  // Según el manual (SIN VERIFICAR contra la API), un TN inexistente vuelve sin
  // `trackingNumber`: no se puede aparear y no debe contaminar el índice con el
  // estado de otro envío. Sea o no esa la forma exacta, un ítem sin TN no es
  // atribuible a nadie y descartarlo es lo correcto.
  it('ítems sin trackingNumber se descartan', async () => {
    const index = await pollCorreoTrackingBatched(
      ['MER1'],
      async () => [{ id: null, quantity: 0, event: [] }],
      { batchSize: 10 },
    );
    assert.equal(index.size, 0);
  });

  it('un lote que falla no tumba los demás', async () => {
    const warnings: string[] = [];
    const index = await pollCorreoTrackingBatched(
      ['A', 'B', 'C', 'D'],
      async (batch) => {
        if (batch.includes('A')) throw new Error('500 del gateway');
        return batch.map((tn) => item(tn, [{ status: 'ENTREGADO' }]));
      },
      {
        batchSize: 2,
        logger: {
          error: () => {},
          warn: (message: string) => warnings.push(message),
        },
      },
    );

    assert.equal(index.size, 2, 'el segundo lote se procesó igual');
    assert.equal(index.get('C')?.status, 'delivered');
    assert.equal(warnings.length, 1);
  });

  it('sin TNs no hace ninguna llamada', async () => {
    let calls = 0;
    const index = await pollCorreoTrackingBatched([null, '', undefined], async () => {
      calls++;
      return [];
    });
    assert.equal(calls, 0);
    assert.equal(index.size, 0);
  });
});
