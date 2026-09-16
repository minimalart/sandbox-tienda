/**
 * El módulo supervisado contra el BullMQ REAL, con un ioredis de mentira.
 *
 * `event-bus-worker-supervisor.test.ts` prueba la lógica con dobles. Esto prueba
 * lo que los dobles no pueden: que el diagnóstico del bug de Medusa es correcto
 * sobre la copia instalada de `bullmq`, y que el envoltorio se engancha en el
 * servicio de verdad. Concretamente:
 *
 *   1. Que un Worker cuya conexión bloqueante falló en su PRIMER intento rechaza
 *      `run()` para siempre, aunque el socket se recupere por detrás (el mecanismo
 *      exacto de las tres caídas de producción, ver el encabezado del supervisor).
 *   2. Que el supervisor lo cierra, construye otro con la clase `Worker` real y
 *      ese otro sí conecta y queda consumiendo.
 *   3. Que el prefijo de la cola sigue siendo el de Medusa en la Queue y el Worker.
 *   4. Que el apagado ordenado detiene al supervisor y no reconstruye.
 *
 * El ioredis falso implementa lo justo que BullMQ 5.13 toca al construir Queue y
 * Worker y al entrar al loop de consumo: `status`, `connect`, `duplicate`,
 * `defineCommand`, `info`, `hmset`, `bzpopmin`. Si BullMQ cambia, se rompe acá y
 * no en producción.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import moduleDefinition, { EVENT_BUS_QUEUE_PREFIX } from './index.ts';

const INFO = '# Server\r\nredis_version:7.2.4\r\n# Memory\r\nmaxmemory_policy:noeviction\r\n';

type Plan = { status: 'ready' | 'wait'; firstConnectFails?: boolean };

class FakeRedis extends EventEmitter {
  status: string;
  options: Record<string, unknown>;
  connectAttempts = 0;
  disconnects = 0;

  constructor(
    private readonly plan: Plan,
    private readonly duplicates: Plan[],
    options: Record<string, unknown> = {},
  ) {
    super();
    this.status = plan.status;
    this.options = options;
  }

  /** BullMQ duplica la conexión de Medusa para su comando bloqueante (`worker.js:105`). */
  duplicate(override: Record<string, unknown> = {}): FakeRedis {
    const plan = this.duplicates.shift() ?? { status: 'ready' as const };
    return new FakeRedis(plan, this.duplicates, { ...this.options, ...override });
  }

  connect(): Promise<void> {
    this.connectAttempts += 1;
    if (this.plan.firstConnectFails && this.connectAttempts === 1) {
      // ioredis (`Redis.js:218-220`): el primer intento cerró antes de `ready`, así
      // que la promesa de connect() rechaza... pero por detrás sigue reintentando.
      this.status = 'reconnecting';
      return Promise.reject(new Error('Connection is closed.'));
    }
    this.status = 'ready';
    setImmediate(() => this.emit('ready'));
    return Promise.resolve();
  }

  /** Lo que ioredis hace al recuperar el socket: pasa a `ready` y lo anuncia. */
  recover(): void {
    this.status = 'ready';
    this.emit('ready');
  }

  disconnect(): void {
    this.disconnects += 1;
    this.status = 'end';
    this.emit('close');
    this.emit('end');
  }

  quit(): Promise<string> {
    this.disconnect();
    return Promise.resolve('OK');
  }

  defineCommand(name: string): void {
    (this as unknown as Record<string, unknown>)[name] = () => Promise.resolve(null);
  }

  info(): Promise<string> {
    return Promise.resolve(INFO);
  }

  hmset(): Promise<string> {
    return Promise.resolve('OK');
  }

  /** El comando bloqueante del consumidor: "no llegó nada" cada 20 ms. */
  bzpopmin(): Promise<null> {
    return new Promise((resolve) => setTimeout(() => resolve(null), 20));
  }
}

type BullWorkerInternals = {
  isRunning(): boolean;
  run(): Promise<unknown>;
  waitUntilReady(): Promise<unknown>;
  opts: { prefix?: string };
  blockingConnection: { _client: FakeRedis };
};

type ServiceInternals = {
  queue_: { opts: { prefix?: string }; keys: { marker: string } };
  bullWorker_: BullWorkerInternals;
  workerSupervisor: { snapshot(): { state: string; restarts: number; consecutiveFailures: number } } | null;
  __hooks: {
    onApplicationStart(): Promise<void>;
    onApplicationPrepareShutdown(): Promise<void>;
    onApplicationShutdown(): Promise<void>;
  };
};

async function waitFor(predicate: () => boolean, label: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`se agotó la espera: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('modules/event-bus-redis sobre el BullMQ instalado', () => {
  const logs = { info: [] as string[], warn: [] as string[], error: [] as string[] };
  const logger = {
    info: (message: string) => void logs.info.push(message),
    warn: (message: string) => void logs.warn.push(message),
    error: (message: string) => void logs.error.push(message),
    debug: () => undefined,
    log: () => undefined,
  };

  // La conexión de Medusa está sana. El PRIMER duplicado (la conexión bloqueante
  // del worker inicial) nace en `wait` y falla su primer intento: es el worker
  // envenenado. El segundo duplicado (el del worker reconstruido) está sano.
  const connection = new FakeRedis({ status: 'ready' }, [
    { status: 'wait', firstConnectFails: true },
    { status: 'ready' },
  ]);

  const previousEnv = {
    min: process.env.EVENT_BUS_WORKER_RESTART_MIN_MS,
    max: process.env.EVENT_BUS_WORKER_RESTART_MAX_MS,
    enabled: process.env.EVENT_BUS_WORKER_SUPERVISOR,
  };

  let service: ServiceInternals;
  let poisoned: BullWorkerInternals;
  let shutDown = false;

  before(() => {
    process.env.EVENT_BUS_WORKER_RESTART_MIN_MS = '20';
    process.env.EVENT_BUS_WORKER_RESTART_MAX_MS = '40';
    delete process.env.EVENT_BUS_WORKER_SUPERVISOR;

    const Service = moduleDefinition.service as new (...args: unknown[]) => ServiceInternals;
    service = new Service(
      {
        logger,
        eventBusRedisConnection: connection,
        eventBusRedisQueueName: 'events-queue',
        eventBusRedisQueueOptions: {},
        // Sin chequeo de stalled (abre timers de 30 s) y con esperas cortas para
        // que el loop de consumo gire rápido sobre el Redis falso.
        eventBusRedisWorkerOptions: { skipStalledCheck: true, drainDelay: 0.05, runRetryDelay: 20, concurrency: 2 },
        eventBusRedisJobOptions: {},
      },
      {},
      { worker_mode: 'shared' },
    );
    poisoned = service.bullWorker_;
  });

  after(async () => {
    if (!shutDown) {
      await service.__hooks.onApplicationPrepareShutdown();
      await service.__hooks.onApplicationShutdown();
    }
    process.env.EVENT_BUS_WORKER_RESTART_MIN_MS = previousEnv.min;
    process.env.EVENT_BUS_WORKER_RESTART_MAX_MS = previousEnv.max;
    process.env.EVENT_BUS_WORKER_SUPERVISOR = previousEnv.enabled;
    for (const key of ['EVENT_BUS_WORKER_RESTART_MIN_MS', 'EVENT_BUS_WORKER_RESTART_MAX_MS', 'EVENT_BUS_WORKER_SUPERVISOR']) {
      if (process.env[key] === undefined) delete process.env[key];
    }
  });

  it('conserva el prefijo de cola de Medusa en la Queue y en el Worker, aunque la clase se llame distinto', () => {
    assert.equal(EVENT_BUS_QUEUE_PREFIX, 'RedisEventBusService');
    assert.equal(service.queue_.opts.prefix, EVENT_BUS_QUEUE_PREFIX);
    assert.equal(service.bullWorker_.opts.prefix, EVENT_BUS_QUEUE_PREFIX);
    assert.ok(
      service.queue_.keys.marker.startsWith('RedisEventBusService:events-queue:'),
      `las claves de Redis cambiaron de namespace: ${service.queue_.keys.marker}`,
    );
    assert.notEqual(moduleDefinition.service.name, EVENT_BUS_QUEUE_PREFIX, 'el test sólo prueba algo si la clase NO se llama como el prefijo');
  });

  it('no exporta discoveryPath: el cargador de Medusa usaría el servicio del paquete en vez de éste', async () => {
    const exported = (await import('./index.ts')) as Record<string, unknown>;
    assert.equal('discoveryPath' in exported, false);
    assert.equal(typeof moduleDefinition.service, 'function');
    assert.ok(Array.isArray(moduleDefinition.loaders) && moduleDefinition.loaders.length === 1, 'reusa el loader de Medusa (la conexión a Redis)');
  });

  it('reproduce el bug: la conexión bloqueante que falló al primer intento envenena run() para siempre', async () => {
    await assert.rejects(poisoned.run(), /Connection is closed/);

    // El socket se recupera por detrás, como hace ioredis con su retryStrategy...
    poisoned.blockingConnection._client.recover();
    assert.equal(poisoned.blockingConnection._client.status, 'ready');

    // ...y BullMQ sigue devolviendo la promesa rechazada que guardó la primera vez.
    await assert.rejects(poisoned.waitUntilReady(), /Connection is closed/);
    assert.equal(poisoned.isRunning(), false);
  });

  it('el supervisor cierra el worker envenenado y arranca uno nuevo que sí conecta', async () => {
    await service.__hooks.onApplicationStart();

    await waitFor(
      () => service.bullWorker_ !== poisoned && service.bullWorker_.isRunning(),
      'que el supervisor reemplace el worker envenenado',
    );
    await service.bullWorker_.waitUntilReady();

    assert.equal(poisoned.blockingConnection._client.disconnects, 1, 'el muerto soltó su conexión bloqueante');
    assert.equal(service.bullWorker_.opts.prefix, EVENT_BUS_QUEUE_PREFIX);
    assert.equal(service.bullWorker_.blockingConnection._client.status, 'ready');

    const snapshot = service.workerSupervisor!.snapshot();
    assert.equal(snapshot.restarts, 1);
    assert.equal(snapshot.state, 'running');
    assert.match(logs.error.join('\n'), /El worker del event bus murió tras \d+ ms: Connection is closed\./);

    await waitFor(() => logs.info.some((line) => line.includes('RECUPERADO')), 'la confirmación de recuperación');
    assert.equal(service.workerSupervisor!.snapshot().consecutiveFailures, 0);
  });

  it('el apagado ordenado detiene al supervisor y cierra el worker vigente sin reconstruirlo', async () => {
    const current = service.bullWorker_;
    await service.__hooks.onApplicationPrepareShutdown();
    await service.__hooks.onApplicationShutdown();
    shutDown = true;
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(service.workerSupervisor!.snapshot().state, 'stopped');
    assert.equal(service.bullWorker_, current, 'un cierre ordenado no es una muerte: no se reconstruye');
    assert.equal(current.isRunning(), false);
    assert.equal(service.workerSupervisor!.snapshot().restarts, 1);
  });
});
