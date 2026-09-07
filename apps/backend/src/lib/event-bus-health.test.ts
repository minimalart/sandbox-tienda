/**
 * Lo que este archivo protege NO es "que el monitor ande": es que el monitor no
 * pueda dar VERDE cuando no vio nada.
 *
 * Los tres modos de falso verde que se probaron acá son los tres que un monitor
 * escrito de apuro tiene:
 *
 *   1. Mirar `wait` y no `prioritized`. Medusa le pone prioridad a TODO evento, así
 *      que `wait` es 0 siempre: un monitor así habría dado verde los tres días.
 *   2. Confundir "cola vacía" con "consumidor sano". De madrugada las dos cosas se
 *      ven igual, y por eso el estado del worker se chequea primero.
 *   3. Tratar "no pude leer" como "todo bien".
 *
 * Todo lo de acá corre sin Redis, sin BullMQ y sin contenedor: `readEventBusSnapshot`
 * recibe la cola inyectada, igual que `syncCorreoTrackingPages` recibe sus puertos.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AlertThrottle,
  assessEventBusHealth,
  formatDownReport,
  PENDING_SAMPLE,
  readEventBusSnapshot,
  redisEventBusExpected,
  type EventBusJobLike,
  type EventBusQueueLike,
  type EventBusSnapshot,
} from './event-bus-health.ts';

const NOW = Date.parse('2026-08-31T21:35:33.000Z');
const MIN = 60_000;
const STALL = { stallMs: 10 * MIN };

/** Cola falsa. `getJobs` distingue las dos llamadas por el tipo pedido, igual que
 *  las hace `readEventBusSnapshot`. */
function fakeQueue(input: {
  counts?: Partial<Record<'wait' | 'prioritized' | 'active' | 'delayed', number>>;
  pending?: EventBusJobLike[];
  active?: EventBusJobLike[];
}): EventBusQueueLike {
  return {
    async getJobCounts(...types: string[]) {
      const counts: Record<string, number> = {};
      for (const type of types) {
        counts[type] = input.counts?.[type as keyof typeof input.counts] ?? 0;
      }
      return counts;
    },
    async getJobs(types: string[]) {
      return types.includes('active') ? (input.active ?? []) : (input.pending ?? []);
    },
  };
}

const running = { isRunning: () => true };
const dead = { isRunning: () => false };

const snapshotOf = (overrides: Partial<EventBusSnapshot> = {}): EventBusSnapshot => ({
  workerRunning: true,
  counts: { wait: 0, prioritized: 0, active: 0, delayed: 0 },
  pendingDepth: 0,
  oldestPendingAgeMs: null,
  oldestActiveAgeMs: null,
  oldestPendingName: null,
  oldestActiveName: null,
  sampleTruncated: false,
  ...overrides,
});

describe('redisEventBusExpected', () => {
  it('sin REDIS_URL no hay cola que vigilar', () => {
    assert.equal(redisEventBusExpected({}), false);
    assert.equal(redisEventBusExpected({ REDIS_URL: '   ' }), false);
  });

  it('DISABLE_REDIS gana aunque haya REDIS_URL: es el mismo gate de medusa-config', () => {
    // `medusa-config.ts:83` hace exactamente esto. Si divergen, el monitor opina
    // sobre una configuración que la app no tiene.
    assert.equal(
      redisEventBusExpected({ DISABLE_REDIS: 'true', REDIS_URL: 'redis://x' }),
      false,
    );
    assert.equal(redisEventBusExpected({ REDIS_URL: 'rediss://x' }), true);
  });
});

describe('readEventBusSnapshot', () => {
  it('cuenta `prioritized`, que es DONDE ESPERAN de verdad los eventos de Medusa', async () => {
    // El falso verde número uno. `buildEvents` le pone prioridad a todo evento y
    // BullMQ manda los priorizados al ZSET `prioritized`, no a la lista `wait`. Un
    // monitor que sólo mire `wait` ve 0 con la cola llena.
    const snapshot = await readEventBusSnapshot({
      queue: fakeQueue({
        counts: { wait: 0, prioritized: 42 },
        pending: [{ name: 'order.placed', timestamp: NOW - 3 * MIN }],
      }),
      worker: running,
      now: NOW,
    });

    assert.equal(snapshot.counts.wait, 0);
    assert.equal(snapshot.counts.prioritized, 42);
    assert.equal(snapshot.pendingDepth, 42, 'la profundidad tiene que sumar las dos poblaciones');
  });

  it('la antigüedad es la del MÁS VIEJO del sample, no la del primero', async () => {
    const snapshot = await readEventBusSnapshot({
      queue: fakeQueue({
        counts: { prioritized: 3 },
        pending: [
          { name: 'nuevo', timestamp: NOW - 1 * MIN },
          { name: 'viejo', timestamp: NOW - 47 * MIN },
          { name: 'medio', timestamp: NOW - 5 * MIN },
        ],
      }),
      worker: running,
      now: NOW,
    });

    assert.equal(snapshot.oldestPendingAgeMs, 47 * MIN);
    assert.equal(
      snapshot.oldestPendingName,
      'viejo',
      'el aviso tiene que nombrar el evento que produce la antigüedad',
    );
  });

  it('los activos se miden por `processedOn`, no por `timestamp`', async () => {
    // Mezclar los dos relojes contaría la espera EN COLA como tiempo de proceso, y
    // una cola que se está recuperando bien dispararía la alarma de subscriber colgado.
    const snapshot = await readEventBusSnapshot({
      queue: fakeQueue({
        counts: { active: 1 },
        active: [{ name: 'order.placed', timestamp: NOW - 90 * MIN, processedOn: NOW - 2 * MIN }],
      }),
      worker: running,
      now: NOW,
    });

    assert.equal(snapshot.oldestActiveAgeMs, 2 * MIN);
  });

  it('sin `processedOn` cae a `timestamp` en vez de tirar el dato', async () => {
    const snapshot = await readEventBusSnapshot({
      queue: fakeQueue({ counts: { active: 1 }, active: [{ timestamp: NOW - 4 * MIN }] }),
      worker: running,
      now: NOW,
    });
    assert.equal(snapshot.oldestActiveAgeMs, 4 * MIN);
  });

  it('sin worker en este proceso, `workerRunning` es null y no false', async () => {
    // `null` es "no sé" (worker_mode = server). Si fuera `false`, cada contenedor de
    // sólo-HTTP reportaría el bus muerto y la alerta se volvería ruido.
    const snapshot = await readEventBusSnapshot({ queue: fakeQueue({}), worker: null, now: NOW });
    assert.equal(snapshot.workerRunning, null);
  });

  it('declara cuándo el sample no alcanza en vez de mentir con un máximo falso', async () => {
    const snapshot = await readEventBusSnapshot({
      queue: fakeQueue({ counts: { prioritized: PENDING_SAMPLE + 1 } }),
      worker: running,
      now: NOW,
    });
    assert.equal(snapshot.sampleTruncated, true);
  });

  it('lo que la cola no sepa contestar NO se convierte en un cero silencioso', async () => {
    const queue: EventBusQueueLike = {
      async getJobCounts() {
        throw new Error('NOSCRIPT');
      },
      async getJobs() {
        return [];
      },
    };
    await assert.rejects(
      () => readEventBusSnapshot({ queue, worker: running, now: NOW }),
      /NOSCRIPT/,
      'tiene que LANZAR: el que llama reporta "no pude medir", nunca "todo bien"',
    );
  });
});

describe('assessEventBusHealth', () => {
  it('worker detenido con la cola VACÍA ya es una caída', () => {
    // El falso verde número dos, y el único caso que la profundidad no puede ver:
    // de madrugada, sin tráfico, la cola está en 0 con el bus sano y con el bus
    // muerto. `isRunning() === false` es evidencia directa del mecanismo B.
    const verdict = assessEventBusHealth(snapshotOf({ workerRunning: false }), STALL);
    assert.equal(verdict.status, 'down');
    assert.equal(verdict.status === 'down' && verdict.kind, 'worker-not-running');
  });

  it('el worker se evalúa ANTES que la antigüedad: nombra la causa en vez de inferirla', () => {
    const verdict = assessEventBusHealth(
      snapshotOf({ workerRunning: false, oldestPendingAgeMs: 3 * 24 * 60 * MIN, pendingDepth: 900 }),
      STALL,
    );
    assert.equal(verdict.status === 'down' && verdict.kind, 'worker-not-running');
  });

  it('un pico grande pero FRESCO es salud, no falla', () => {
    // Por esto la señal no puede ser la profundidad: 3.000 eventos de hace 10
    // segundos son una importación, no una caída.
    const verdict = assessEventBusHealth(
      snapshotOf({ pendingDepth: 3_000, counts: { wait: 0, prioritized: 3_000, active: 10, delayed: 0 }, oldestPendingAgeMs: 10_000 }),
      STALL,
    );
    assert.equal(verdict.status, 'ok');
  });

  it('un solo evento viejo alcanza: la señal es la antigüedad, no el volumen', () => {
    const verdict = assessEventBusHealth(
      snapshotOf({ pendingDepth: 1, oldestPendingAgeMs: 11 * MIN, oldestPendingName: 'order.placed' }),
      STALL,
    );
    assert.equal(verdict.status === 'down' && verdict.kind, 'queue-stalled');
    assert.match(verdict.status === 'down' ? verdict.detail : '', /order\.placed/);
  });

  it('justo en el umbral dispara, un milisegundo antes no', () => {
    assert.equal(assessEventBusHealth(snapshotOf({ oldestPendingAgeMs: 10 * MIN }), STALL).status, 'down');
    assert.equal(assessEventBusHealth(snapshotOf({ oldestPendingAgeMs: 10 * MIN - 1 }), STALL).status, 'ok');
  });

  it('un activo clavado es el mecanismo A y se nombra distinto', () => {
    // La concurrencia > 1 baja la probabilidad pero no la elimina: con 10 slots,
    // 10 subscribers colgados hacen lo mismo que uno con concurrencia 1.
    const verdict = assessEventBusHealth(
      snapshotOf({ counts: { wait: 0, prioritized: 0, active: 1, delayed: 0 }, oldestActiveAgeMs: 30 * MIN, oldestActiveName: 'order.placed' }),
      STALL,
    );
    assert.equal(verdict.status === 'down' && verdict.kind, 'subscriber-stuck');
  });

  it('cola vacía con el worker corriendo es lo único que da verde', () => {
    assert.equal(assessEventBusHealth(snapshotOf(), STALL).status, 'ok');
  });

  it('`workerRunning: null` no cuenta como worker caído', () => {
    assert.equal(assessEventBusHealth(snapshotOf({ workerRunning: null }), STALL).status, 'ok');
  });
});

describe('AlertThrottle', () => {
  it('la primera detección avisa YA; las siguientes esperan la ventana', () => {
    const throttle = new AlertThrottle(30 * MIN);
    assert.equal(throttle.shouldEmit('queue-stalled', NOW), true);
    assert.equal(throttle.shouldEmit('queue-stalled', NOW + 5 * MIN), false);
    assert.equal(throttle.shouldEmit('queue-stalled', NOW + 31 * MIN), true);
  });

  it('una falla NUEVA no queda tapada por la ventana de otra', () => {
    // Por esto la clave es el TIPO. Si el bus pasa de `subscriber-stuck` a
    // `worker-not-running`, eso es información nueva y tiene que salir.
    const throttle = new AlertThrottle(30 * MIN);
    assert.equal(throttle.shouldEmit('subscriber-stuck', NOW), true);
    assert.equal(throttle.shouldEmit('worker-not-running', NOW), true);
  });

  it('`reset` sólo dice que sí cuando hubo caída: el "recuperado" no se inventa', () => {
    const throttle = new AlertThrottle(30 * MIN);
    assert.equal(throttle.reset(), false, 'sin alertas previas no hay recuperación que anunciar');
    throttle.shouldEmit('queue-stalled', NOW);
    assert.equal(throttle.reset(), true);
    assert.equal(throttle.shouldEmit('queue-stalled', NOW + 1), true, 'tras el reset vuelve a avisar de una');
  });
});

describe('formatDownReport', () => {
  it('dice que la antigüedad es un PISO cuando el sample no alcanzó', () => {
    const report = formatDownReport(
      { status: 'down', kind: 'queue-stalled', detail: 'x' },
      snapshotOf({ sampleTruncated: true }),
    );
    assert.match(report, /PISO/);
  });

  it('nombra la línea de log del mecanismo B, que es la única pista que deja', () => {
    const report = formatDownReport(
      { status: 'down', kind: 'worker-not-running', detail: 'x' },
      snapshotOf({ workerRunning: false }),
    );
    assert.match(report, /Error running event bus worker/);
  });
});

describe('el monitor no arrastra dependencias nuevas', () => {
  it('ni el job ni la librería importan `bullmq` o `ioredis`', () => {
    // Es la decisión de diseño, y es la que alguien va a querer "simplificar":
    // ninguno de los dos es dep directa de apps/backend, así que importarlos
    // significaría o mover el lockfile o depender del hoisting de pnpm. La cola se
    // toma del objeto que el módulo de event bus ya tiene abierto.
    for (const file of ['./event-bus-health.ts', '../jobs/event-bus-monitor.ts']) {
      const src = readFileSync(join(import.meta.dirname, file), 'utf8');
      assert.doesNotMatch(
        src,
        /^\s*import[^\n]*from\s+'(bullmq|ioredis)'/m,
        `${file} importa una dependencia que apps/backend no declara`,
      );
    }
  });

  it('el job no importa ESTÁTICAMENTE ningún `src/modules/**` de una extensión', () => {
    /**
     * Esto NO es prolijidad, es a quién pertenece el archivo.
     *
     * `resolve-ownership.js` le regala todo archivo de `src/jobs/` a la extensión
     * cuyo módulo importe. Con un `import` estático de
     * `../modules/email/admin-recipient`, `site:components:verify` reporta
     * `[ownership] email-templates: extract owns apps/backend/src/jobs/event-bus-monitor.ts`
     * — o sea que el monitor del event bus pasa a ser parte de "Plantillas de
     * email" y desaparece de toda instalación que no elija esa extensión. Un
     * monitor de infraestructura no puede colgar de una extensión opcional, y
     * menos de una que este mismo job usa sólo para el canal de aviso.
     *
     * El `import()` perezoso de `mailAdmin` es lo que mantiene la propiedad donde
     * corresponde. Alguien va a querer "arreglarlo" moviéndolo arriba.
     */
    const src = readFileSync(join(import.meta.dirname, '../jobs/event-bus-monitor.ts'), 'utf8');
    assert.doesNotMatch(
      src,
      /^\s*import[^\n]*from\s+'\.\.\/modules\//m,
      'un import estático a `../modules/**` le entrega este job a la extensión dueña de ese módulo',
    );
  });
});
