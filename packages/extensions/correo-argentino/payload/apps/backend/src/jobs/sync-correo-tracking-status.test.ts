/**
 * El recorrido del sync es la pieza con más forma de bug silencioso del job: si
 * el offset avanza mal se saltean envíos SIN ningún error, y si el batcheo se
 * rompe el job vuelve a hacer una llamada HTTP por envío (que es exactamente lo
 * que la API de Correo permite evitar).
 *
 * `syncCorreoTrackingPages` recibe sus dependencias inyectadas, así que todo esto
 * se ejercita sin base de datos ni HTTP.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { DeliveryExecutionRecord, NormalizedStatusUpdate } from '../modules/delivery/providers/types.ts';
import type { DeliveryExecutionStatus } from '../modules/delivery/types.ts';
import {
  inCorreoBusinessHours,
  syncCorreoTrackingPages,
  type CorreoSyncPorts,
} from './sync-correo-tracking-status.ts';

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const execution = (
  id: string,
  overrides: Partial<DeliveryExecutionRecord> = {},
): DeliveryExecutionRecord => ({
  id,
  provider_type: 'correo_argentino',
  service_mode: 'home_delivery',
  status: 'pending',
  tracking_number: `TN-${id}`,
  attempt_count: 0,
  ...overrides,
});

/** Puerto de listado sobre un array fijo, con la semántica de skip/take. */
const pagedListing = (
  all: DeliveryExecutionRecord[],
  calls: Array<{ skip: number; take: number }>,
): CorreoSyncPorts['listOpenExecutions'] =>
  async (skip, take) => {
    calls.push({ skip, take });
    return all.slice(skip, skip + take);
  };

describe('inCorreoBusinessHours', () => {
  it('sin el flag prendido nunca gatea', () => {
    const madrugada = new Date('2026-08-04T06:00:00Z'); // 03:00 ART
    assert.equal(inCorreoBusinessHours(madrugada, {}), true);
    assert.equal(
      inCorreoBusinessHours(madrugada, {
        CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY: 'false',
      }),
      true,
    );
  });

  it('con el flag prendido, 8–21 ART adentro y el resto afuera', () => {
    const env = { CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY: 'true' };
    // UTC-3: el borde inferior es 11:00Z (08:00 ART) y el superior 00:59Z
    // del día siguiente (21:59 ART).
    assert.equal(inCorreoBusinessHours(new Date('2026-08-04T11:00:00Z'), env), true);
    assert.equal(inCorreoBusinessHours(new Date('2026-08-04T15:00:00Z'), env), true);
    assert.equal(inCorreoBusinessHours(new Date('2026-08-05T00:30:00Z'), env), true);
    // Afuera: 07:00 ART y 22:00 ART.
    assert.equal(inCorreoBusinessHours(new Date('2026-08-04T10:00:00Z'), env), false);
    assert.equal(inCorreoBusinessHours(new Date('2026-08-05T01:00:00Z'), env), false);
  });
});

describe('syncCorreoTrackingPages — batcheo', () => {
  it('consulta la página COMPLETA de una vez, no una llamada por envío', async () => {
    const all = Array.from({ length: 5 }, (_, i) => execution(`e${i}`));
    const polls: DeliveryExecutionRecord[][] = [];

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async (executions) => {
        polls.push(executions);
        return new Map();
      },
      transition: async () => {},
    });

    assert.equal(polls.length, 1, 'una sola consulta para los 5 envíos');
    assert.equal(polls[0]?.length, 5);
    assert.equal(stats.polls, 1);
    assert.equal(stats.reviewed, 5);
    assert.equal(stats.unchanged, 5, 'sin novedades no se transiciona nada');
  });

  it('una consulta por PÁGINA (no por envío) cuando hay varias páginas', async () => {
    const all = Array.from({ length: 7 }, (_, i) => execution(`e${i}`));
    const polls: DeliveryExecutionRecord[][] = [];

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 3,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async (executions) => {
        polls.push(executions);
        return new Map();
      },
      transition: async () => {},
    });

    assert.equal(stats.pages, 3);
    assert.equal(polls.length, 3, '7 envíos en páginas de 3 son 3 consultas');
    assert.deepEqual(
      polls.map((page) => page.length),
      [3, 3, 1],
    );
  });

  it('las ejecuciones sin tracking number no se consultan', async () => {
    const all = [
      execution('con-tn'),
      execution('sin-tn', { tracking_number: null }),
      execution('vacio', { tracking_number: '   ' }),
    ];
    const polls: DeliveryExecutionRecord[][] = [];

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async (executions) => {
        polls.push(executions);
        return new Map();
      },
      transition: async () => {},
    });

    assert.deepEqual(polls[0]?.map((e) => e.id), ['con-tn']);
    assert.equal(stats.reviewed, 1);
  });

  it('sin ningún envío consultable no se llama al carrier', async () => {
    let polls = 0;
    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing(
        [execution('a', { tracking_number: null })],
        [],
      ),
      pollBatch: async () => {
        polls++;
        return new Map();
      },
      transition: async () => {},
    });
    assert.equal(polls, 0);
    assert.equal(stats.polls, 0);
    assert.equal(stats.reviewed, 0);
  });
});

describe('syncCorreoTrackingPages — transiciones', () => {
  const update = (status: DeliveryExecutionStatus): NormalizedStatusUpdate => ({
    status,
    raw_status: 'ENT',
    events: [],
  });

  it('aplica la transición solo cuando el estado CAMBIA', async () => {
    const all = [
      execution('avanza', { status: 'pending' }),
      execution('igual', { status: 'in_transit' }),
      execution('sin-novedad'),
    ];
    const transitions: string[] = [];

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async () =>
        new Map([
          ['avanza', update('in_transit')],
          ['igual', update('in_transit')],
        ]),
      transition: async (input) => {
        transitions.push(`${input.execution_id}:${input.to_status}`);
      },
    });

    assert.deepEqual(transitions, ['avanza:in_transit']);
    assert.equal(stats.transitioned, 1);
    assert.equal(stats.unchanged, 2);
  });

  it('una transición que falla no corta el recorrido', async () => {
    const all = [execution('rota'), execution('ok')];
    const transitions: string[] = [];

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async () =>
        new Map([
          ['rota', update('delivered')],
          ['ok', update('delivered')],
        ]),
      transition: async (input) => {
        if (input.execution_id === 'rota') throw new Error('NOT_ALLOWED');
        transitions.push(input.execution_id);
      },
    });

    assert.deepEqual(transitions, ['ok']);
    assert.equal(stats.errors, 1);
    assert.equal(stats.transitioned, 1);
  });

  it('un fallo de la consulta cuenta errores y sigue con la próxima página', async () => {
    const all = Array.from({ length: 4 }, (_, i) => execution(`e${i}`));
    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 2,
      listOpenExecutions: pagedListing(all, []),
      pollBatch: async (executions) => {
        if (executions[0]?.id === 'e0') throw new Error('gateway caído');
        return new Map();
      },
      transition: async () => {},
    });

    assert.equal(stats.pages, 2, 'la segunda página se recorrió igual');
    assert.equal(stats.errors, 2);
  });

  it('propaga el source del evento al timeline', async () => {
    const events: unknown[] = [];
    await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 10,
      listOpenExecutions: pagedListing([execution('a')], []),
      pollBatch: async () => new Map([['a', update('delivered')]]),
      transition: async (input) => {
        events.push(input.event);
      },
    });

    assert.deepEqual(events, [
      { source: 'correo-tracking-sync', raw_status: 'ENT', events: [] },
    ]);
  });
});

describe('syncCorreoTrackingPages — compensación de drift de offset', () => {
  /**
   * El escenario que la compensación existe para cubrir: se pagina con `$nin`
   * sobre los estados terminales, así que las filas que pasan a `delivered`
   * durante el recorrido SALEN del set y corren el offset. Con `skip +=
   * PAGE_SIZE` pelado, la fila que sigue a las que se fueron nunca se revisa.
   */
  it('el offset avanza solo por las ejecuciones que SIGUEN en el set', async () => {
    const calls: Array<{ skip: number; take: number }> = [];
    const polled: string[] = [];
    // Set "vivo": las entregadas se van, como haría el $nin de Postgres.
    let remaining = Array.from({ length: 6 }, (_, i) => execution(`e${i}`));

    const stats = await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 2,
      listOpenExecutions: async (skip, take) => {
        calls.push({ skip, take });
        return remaining.slice(skip, skip + take);
      },
      // La primera de cada página se entrega (sale del set); la otra no cambia.
      pollBatch: async (executions) => {
        polled.push(...executions.map((e) => e.id));
        return new Map(
          executions
            .slice(0, 1)
            .map((e) => [e.id, { status: 'delivered' } as NormalizedStatusUpdate]),
        );
      },
      transition: async (input) => {
        remaining = remaining.filter((e) => e.id !== input.execution_id);
      },
    });

    // LA aserción que importa: ninguna ejecución quedó sin revisar. Con `skip +=
    // pageSize` pelado, la segunda página sería [e3,e4] y e2 no se revisaría
    // NUNCA — sin ningún error que lo delate.
    assert.deepEqual(polled, ['e0', 'e1', 'e2', 'e3', 'e4', 'e5']);

    // Página 1 (skip 0): e0 entregada, e1 sin cambio → 1 salió, offset 0+2-1=1.
    // Página 2 (skip 1): el set ya es [e1..e5]; skip 1 = [e2,e3] → e2 entregada.
    // Sin la compensación el skip sería 2 y e2 nunca se habría revisado.
    assert.deepEqual(
      calls.map((c) => c.skip),
      [0, 1, 2, 3],
    );
    // 3 páginas de 2 revisadas (la cuarta llamada vuelve vacía y corta), y las
    // 3 entregas se aplicaron: ninguna fila quedó sin revisar por el corrimiento.
    assert.equal(stats.reviewed, 6);
    assert.equal(stats.transitioned, 3);
  });

  it('una transición a terminal que FALLA no descuenta el offset', async () => {
    const calls: Array<{ skip: number; take: number }> = [];
    const all = Array.from({ length: 4 }, (_, i) => execution(`e${i}`));

    await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 2,
      listOpenExecutions: pagedListing(all, calls),
      pollBatch: async (executions) =>
        new Map(
          executions.map((e) => [
            e.id,
            { status: 'delivered' } as NormalizedStatusUpdate,
          ]),
        ),
      // Nadie sale del set: todas las transiciones se rechazan.
      transition: async () => {
        throw new Error('NOT_ALLOWED');
      },
    });

    assert.deepEqual(
      calls.map((c) => c.skip),
      [0, 2, 4],
      'sin bajas efectivas el offset avanza el tamaño de página completo',
    );
  });

  it('la última página parcial corta el recorrido', async () => {
    const calls: Array<{ skip: number; take: number }> = [];
    await syncCorreoTrackingPages({
      logger: silentLogger,
      pageSize: 5,
      listOpenExecutions: pagedListing(
        [execution('a'), execution('b')],
        calls,
      ),
      pollBatch: async () => new Map(),
      transition: async () => {},
    });
    assert.equal(calls.length, 1, 'no se pide una página más de la cuenta');
  });
});
