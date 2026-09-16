/**
 * Lo que este archivo protege: que el worker del event bus NO pueda quedar muerto
 * en un proceso sano. Cada test fija una decisión del supervisor que, si se
 * pierde, devuelve alguna de las tres caídas mudas de producción (ver el
 * encabezado de `event-bus-worker-supervisor.ts`).
 *
 * Todo corre sin BullMQ, sin Redis y sin reloj real: el worker es un doble con
 * `run()` controlable y el tiempo lo maneja una cola de timers manual.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MIN_DELAY_MS,
  EventBusWorkerSupervisor,
  FOREIGN_RUN_POLL_MS,
  describeSupervisor,
  requestSupervisorRestart,
  type EventBusWorkerSupervisorOptions,
  type SupervisedWorker,
  type SupervisorLogger,
  type SupervisorTimer,
} from './event-bus-worker-supervisor.ts';

/** Deja correr las microtareas encoladas: el supervisor encadena varios `await` por paso. */
async function settle(rounds = 12): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

class FakeTimer implements SupervisorTimer {
  now = 0;
  private seq = 0;
  private readonly pending = new Map<number, { at: number; callback: () => void }>();

  set(callback: () => void, ms: number): unknown {
    this.seq += 1;
    this.pending.set(this.seq, { at: this.now + ms, callback });
    return this.seq;
  }

  clear(handle: unknown): void {
    this.pending.delete(handle as number);
  }

  /** Cuánto falta para cada timer pendiente, en orden de disparo. */
  get scheduled(): number[] {
    return [...this.pending.values()].map((entry) => entry.at - this.now).sort((a, b) => a - b);
  }

  /** Avanza el reloj disparando lo vencido en orden, y deja asentar las microtareas entre timers. */
  async advance(ms: number): Promise<void> {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.pending.entries()]
        .filter(([, entry]) => entry.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      const next = due[0];
      if (!next) break;
      this.pending.delete(next[0]);
      this.now = next[1].at;
      next[1].callback();
      await settle();
    }
    this.now = target;
    await settle();
  }
}

type FakeWorker = SupervisedWorker & {
  label: string;
  runs: number;
  running: boolean;
  closeCalls: boolean[];
  resolveRun(): void;
  rejectRun(error: unknown): void;
};

type FakeWorkerOptions = {
  ready?: 'resolve' | 'reject' | 'pending';
  close?: 'resolve' | 'reject' | 'pending';
};

function fakeWorker(label: string, options: FakeWorkerOptions = {}): FakeWorker {
  let pendingRun: { resolve: () => void; reject: (error: unknown) => void } | null = null;
  const worker: FakeWorker = {
    label,
    runs: 0,
    running: false,
    closeCalls: [],
    isRunning: () => worker.running,
    run() {
      worker.runs += 1;
      worker.running = true;
      return new Promise<void>((resolve, reject) => {
        pendingRun = {
          resolve: () => {
            worker.running = false;
            resolve();
          },
          reject: (error) => {
            worker.running = false;
            reject(error);
          },
        };
      });
    },
    close(force?: boolean) {
      worker.closeCalls.push(force === true);
      worker.running = false;
      if (options.close === 'reject') return Promise.reject(new Error('close reventó'));
      if (options.close === 'pending') return new Promise<void>(() => undefined);
      return Promise.resolve();
    },
    waitUntilReady() {
      if (options.ready === 'reject') return Promise.reject(new Error('Connection is closed.'));
      if (options.ready === 'pending') return new Promise<void>(() => undefined);
      return Promise.resolve();
    },
    resolveRun: () => pendingRun?.resolve(),
    rejectRun: (error) => pendingRun?.reject(error),
  };
  return worker;
}

function collectingLogger(): { lines: Record<'info' | 'warn' | 'error', string[]>; logger: SupervisorLogger } {
  const lines = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  return {
    lines,
    logger: {
      info: (message) => void lines.info.push(message),
      warn: (message) => void lines.warn.push(message),
      error: (message) => void lines.error.push(message),
    },
  };
}

function setup(
  overrides: Partial<EventBusWorkerSupervisorOptions> = {},
  initialOptions: FakeWorkerOptions = {},
  rebuiltOptions: FakeWorkerOptions = {},
) {
  const timer = new FakeTimer();
  const { lines, logger } = collectingLogger();
  const initial = fakeWorker('w0', initialOptions);
  const created: FakeWorker[] = [];
  const seen: Array<[string, string]> = [];
  let factory: () => SupervisedWorker = () => {
    const worker = fakeWorker(`w${created.length + 1}`, rebuiltOptions);
    created.push(worker);
    return worker;
  };
  const supervisor = new EventBusWorkerSupervisor({
    worker: initial,
    createWorker: () => factory(),
    onWorker: (worker, origin) => void seen.push([(worker as FakeWorker).label, origin]),
    logger,
    timer,
    now: () => timer.now,
    ...overrides,
  });
  return {
    timer,
    lines,
    initial,
    created,
    seen,
    supervisor,
    setFactory(next: () => SupervisedWorker) {
      factory = next;
    },
  };
}

const CLOSED = new Error('Connection is closed.');

describe('EventBusWorkerSupervisor', () => {
  it('arranca el worker inicial, lo anuncia y se queda esperando a run()', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    assert.equal(t.initial.runs, 1);
    assert.deepEqual(t.seen, [['w0', 'initial']]);
    assert.equal(t.supervisor.snapshot().state, 'running');
    assert.deepEqual(t.timer.scheduled, [], 'con el worker vivo no hay timers: no se sondea nada');
    assert.equal(t.supervisor.current, t.initial);

    // Idempotente: un segundo start() no arranca un segundo loop ni un segundo run().
    t.supervisor.start();
    await settle();
    assert.equal(t.initial.runs, 1);
  });

  it('si run() rechaza: cuenta la falla, espera el backoff mínimo, cierra con force y construye otro', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();

    const waiting = t.supervisor.snapshot();
    assert.equal(waiting.state, 'waiting');
    assert.equal(waiting.consecutiveFailures, 1);
    assert.equal(waiting.nextRetryAt, DEFAULT_MIN_DELAY_MS);
    assert.deepEqual(t.timer.scheduled, [DEFAULT_MIN_DELAY_MS]);
    assert.deepEqual(t.initial.closeCalls, [], 'no se cierra hasta que vence el backoff');
    assert.equal(t.lines.error.length, 1);
    assert.match(t.lines.error[0]!, /murió tras 0 ms: Connection is closed\./);
    assert.match(t.lines.error[0]!, /en 1000 ms/);
    assert.match(t.lines.error[0]!, /NO se consumen eventos/);

    await t.timer.advance(DEFAULT_MIN_DELAY_MS);

    assert.deepEqual(t.initial.closeCalls, [true], 'el muerto se cierra con force=true: no hay jobs que esperar');
    assert.equal(t.created.length, 1);
    assert.equal(t.created[0]!.runs, 1);
    assert.deepEqual(t.seen, [
      ['w0', 'initial'],
      ['w1', 'rebuilt'],
    ]);
    const running = t.supervisor.snapshot();
    assert.equal(running.state, 'running');
    assert.equal(running.restarts, 1);
    assert.equal(running.nextRetryAt, null);
    assert.equal(t.supervisor.current, t.created[0]);
  });

  it('el backoff se duplica en cada falla seguida y se acota al máximo', async () => {
    const t = setup({ minDelayMs: 1000, maxDelayMs: 8000 }, {}, { ready: 'pending' });
    t.supervisor.start();
    await settle();

    const delays: number[] = [];
    let current: FakeWorker = t.initial;
    for (let i = 0; i < 5; i += 1) {
      current.rejectRun(CLOSED);
      await settle();
      const snapshot = t.supervisor.snapshot();
      delays.push(snapshot.nextRetryAt! - t.timer.now);
      await t.timer.advance(snapshot.nextRetryAt! - t.timer.now);
      current = t.created[t.created.length - 1]!;
    }

    assert.deepEqual(delays, [1000, 2000, 4000, 8000, 8000]);
    assert.equal(t.supervisor.snapshot().restarts, 5);
  });

  it('una recuperación confirmada por waitUntilReady() resetea el backoff', async () => {
    const t = setup({ minDelayMs: 1000, maxDelayMs: 8000 });
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    await t.timer.advance(1000);

    // El worker reconstruido conecta (waitUntilReady resuelve): se declara recuperado.
    assert.equal(t.lines.info.length, 1);
    assert.match(t.lines.info[0]!, /RECUPERADO/);
    assert.match(t.lines.info[0]!, /1 falla\(s\) y 1 reconstrucción\(es\)/);
    assert.equal(t.supervisor.snapshot().consecutiveFailures, 0);

    // La siguiente falla arranca el backoff desde el mínimo, no desde 2000.
    t.created[0]!.rejectRun(CLOSED);
    await settle();
    assert.equal(t.supervisor.snapshot().nextRetryAt! - t.timer.now, 1000);
  });

  it('un waitUntilReady() pendiente NO declara recuperación: isRunning() en true no es estar consumiendo', async () => {
    const t = setup({ minDelayMs: 1000, maxDelayMs: 8000 }, {}, { ready: 'pending' });
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    await t.timer.advance(1000);

    assert.equal(t.created[0]!.isRunning(), true, 'BullMQ marca running desde el primer instante');
    assert.deepEqual(t.lines.info, []);
    assert.equal(t.supervisor.snapshot().consecutiveFailures, 1);

    t.created[0]!.rejectRun(CLOSED);
    await settle();
    assert.equal(t.supervisor.snapshot().nextRetryAt! - t.timer.now, 2000, 'el backoff siguió creciendo');
  });

  it('restartNow() corta la espera y reconstruye ya; fuera de la espera devuelve false', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    assert.equal(t.supervisor.restartNow(), false, 'con el worker vivo no hay nada que cortar');

    t.initial.rejectRun(CLOSED);
    await settle();
    assert.equal(t.supervisor.snapshot().state, 'waiting');

    assert.equal(t.supervisor.restartNow(), true);
    await settle();

    assert.equal(t.created.length, 1);
    assert.equal(t.created[0]!.runs, 1);
    assert.deepEqual(t.timer.scheduled, [], 'el timer del backoff se limpió al cortarlo');
    assert.equal(t.supervisor.restartNow(), false);
  });

  it('stop() durante la espera no reconstruye nada, ni ahora ni cuando venza el timer', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    t.supervisor.stop();
    await settle();

    assert.equal(t.supervisor.snapshot().state, 'stopped');
    assert.equal(t.supervisor.snapshot().nextRetryAt, null);
    assert.deepEqual(t.timer.scheduled, []);
    await t.timer.advance(DEFAULT_MIN_DELAY_MS * 10);
    assert.equal(t.created.length, 0);
    assert.deepEqual(t.initial.closeCalls, [], 'cerrar el worker es del dueño (el hook de shutdown), no del supervisor');
  });

  it('run() que resuelve después de stop() es el apagado ordenado, no una falla', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    t.supervisor.stop();
    t.initial.resolveRun();
    await settle();

    assert.equal(t.supervisor.snapshot().consecutiveFailures, 0);
    assert.equal(t.created.length, 0);
    assert.deepEqual(t.lines.error, []);
  });

  it('run() que resuelve SIN stop() cuenta como falla y reconstruye', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    t.initial.resolveRun();
    await settle();

    assert.equal(t.supervisor.snapshot().state, 'waiting');
    assert.match(t.lines.error[0]!, /se cerró por fuera del supervisor/);

    await t.timer.advance(DEFAULT_MIN_DELAY_MS);
    assert.equal(t.created.length, 1);
    assert.deepEqual(t.initial.closeCalls, [true]);
  });

  it('un worker corriendo en manos de otro no se pisa ni se cuenta como falla: se vuelve a mirar en 5 s', async () => {
    const t = setup();
    t.initial.running = true; // alguien ajeno ya llamó a run()
    t.supervisor.start();
    await settle();

    assert.equal(t.initial.runs, 0);
    assert.deepEqual(t.timer.scheduled, [FOREIGN_RUN_POLL_MS]);

    t.initial.running = false;
    await t.timer.advance(FOREIGN_RUN_POLL_MS);
    assert.equal(t.initial.runs, 1, 'cuando el ajeno soltó el worker, el supervisor lo toma');

    t.initial.rejectRun(new Error('Worker is already running.'));
    await settle();
    assert.equal(t.supervisor.snapshot().consecutiveFailures, 0);
    assert.deepEqual(t.lines.error, []);
    assert.deepEqual(t.timer.scheduled, [FOREIGN_RUN_POLL_MS]);
  });

  it('si construir el worker nuevo falla, reintenta con backoff y nunca se queda con el muerto', async () => {
    const t = setup();
    let attempts = 0;
    const good = fakeWorker('w-good');
    t.setFactory(() => {
      attempts += 1;
      if (attempts === 1) throw new Error('boom');
      return good;
    });
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    await t.timer.advance(DEFAULT_MIN_DELAY_MS);

    assert.deepEqual(t.initial.closeCalls, [true]);
    assert.equal(good.runs, 0);
    const snapshot = t.supervisor.snapshot();
    assert.equal(snapshot.consecutiveFailures, 2);
    assert.equal(snapshot.state, 'waiting');
    assert.match(t.lines.error[1]!, /Construir un worker nuevo falló: boom/);
    assert.deepEqual(t.timer.scheduled, [DEFAULT_MIN_DELAY_MS * 2]);

    await t.timer.advance(DEFAULT_MIN_DELAY_MS * 2);
    assert.equal(good.runs, 1);
    assert.equal(t.supervisor.current, good);
    assert.equal(t.supervisor.snapshot().restarts, 1);
  });

  it('un close() del muerto que rechaza no frena la reconstrucción', async () => {
    const t = setup({}, { close: 'reject' });
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    await t.timer.advance(DEFAULT_MIN_DELAY_MS);

    assert.equal(t.created.length, 1);
    assert.equal(t.lines.warn.length, 1);
    assert.match(t.lines.warn[0]!, /close\(true\) del worker muerto falló \(close reventó\)/);
  });

  it('un close() del muerto que se cuelga vence a los 5 s y la reconstrucción sigue', async () => {
    const t = setup({ closeDeadlineMs: 5000 }, { close: 'pending' });
    t.supervisor.start();
    await settle();

    t.initial.rejectRun(CLOSED);
    await settle();
    await t.timer.advance(DEFAULT_MIN_DELAY_MS);

    assert.equal(t.created.length, 0, 'todavía esperando al close()');
    assert.deepEqual(t.timer.scheduled, [5000]);

    await t.timer.advance(5000);
    assert.equal(t.created.length, 1);
    assert.match(t.lines.warn[0]!, /no terminó en 5000 ms/);
  });

  it('si el supervisor mismo revienta, lo dice a nivel error y no tumba el proceso', async () => {
    const t = setup();
    (t.initial as { isRunning: () => boolean }).isRunning = () => {
      throw new Error('bug del supervisor');
    };
    t.supervisor.start();
    await settle();

    assert.equal(t.supervisor.snapshot().state, 'stopped');
    assert.match(t.lines.error[0]!, /murió por un error propio: bug del supervisor/);
  });

  it('describeSupervisor() resume el snapshot en una línea legible', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();
    t.initial.rejectRun(CLOSED);
    await settle();

    const line = describeSupervisor(t.supervisor.snapshot(), t.timer.now);
    assert.match(line, /estado=waiting/);
    assert.match(line, /reconstrucciones=0/);
    assert.match(line, /fallas_consecutivas=1/);
    assert.match(line, /ultimo_error="Connection is closed\." \(hace 0 s\)/);
    assert.match(line, /proximo_reintento_en=1 s/);
  });
});

describe('requestSupervisorRestart (lo que usa el monitor)', () => {
  it('sin supervisor: no se hace cargo y lo dice', () => {
    const request = requestSupervisorRestart(null);
    assert.equal(request.handled, false);
    assert.match(request.line, /no expone supervisor/);
  });

  it('con el supervisor esperando: corta el backoff y se hace cargo', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();
    t.initial.rejectRun(CLOSED);
    await settle();

    const request = requestSupervisorRestart(t.supervisor, t.timer.now);
    assert.equal(request.handled, true);
    assert.match(request.line, /reconstruir AHORA/);
    assert.match(request.line, /estado=waiting/);

    await settle();
    assert.equal(t.created.length, 1, 'la reconstrucción no esperó al timer');
  });

  it('con el supervisor corriendo: no se hace cargo, para que el monitor caiga a su re-arme directo', async () => {
    const t = setup();
    t.supervisor.start();
    await settle();

    const request = requestSupervisorRestart(t.supervisor, t.timer.now);
    assert.equal(request.handled, false);
    assert.match(request.line, /no estaba esperando/);
  });
});
