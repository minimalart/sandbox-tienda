/**
 * El monitor CORRIENDO contra el servicio supervisado de verdad.
 *
 * ── POR QUÉ EXISTE ESTE ARCHIVO ─────────────────────────────────────────────
 *
 * `event-bus-monitor-supervisor.test.ts` y `event-bus-rearm.test.ts` verifican el
 * cableado con `readFileSync` + `assert.match`: son regex sobre el TEXTO del
 * fuente. Prueban que el código esté escrito, no que funcione. Y los 18 tests del
 * supervisor usan dobles. Con las tres cosas en verde, producción hizo esto
 * (backend de mercatto, 2026-09-17, líneas consecutivas):
 *
 *     15:48:26  [event-bus-supervisor] El worker del event bus murió tras 359 ms:
 *               Connection is closed.. Se cierra y se construye uno nuevo en 1000 ms
 *     15:48:27  [event-bus-monitor] EL EVENT BUS NO ESTÁ CONSUMIENDO (worker-not-running)
 *     15:48:27  [event-bus-monitor] Re-arme: el servicio de event bus no expone
 *               supervisor del worker (módulo de Medusa sin envolver).
 *     15:48:27  [event-bus-supervisor] RECUPERADO: el worker volvió a conectarse
 *
 * El supervisor estaba ahí, loguendo desde el mismo proceso, y el monitor mandó un
 * mail al equipo diciendo que el módulo no estaba envuelto. Ningún test podía
 * agarrarlo porque ninguno ejecuta el monitor.
 *
 * ── QUÉ REPRODUCE ───────────────────────────────────────────────────────────
 *
 * El servicio es el REAL (`modules/event-bus-redis`), con el BullMQ instalado y el
 * ioredis falso de `modules/event-bus-redis/index.test.ts`: su worker inicial nace
 * envenenado, `run()` rechaza, y el supervisor entra en backoff. O sea `isRunning()`
 * en false con un supervisor vivo — el estado exacto del 15:48:26.
 *
 * Lo que el contenedor le devuelve al monitor es una COPIA de propiedades propias
 * del servicio. Eso es el punto: `queue_` y `bullWorker_` las setea el constructor
 * de la clase core y sobreviven, `workerSupervisor` es un getter del prototipo de
 * la subclase y se pierde. Es la forma que tenía el objeto en producción, deducida
 * de que el aviso traía la cola medida Y decía que no había supervisor.
 */

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import moduleDefinition from '../modules/event-bus-redis/index.ts';
import { resetLiveEventBusWorkerSupervisor } from '../lib/event-bus-worker-supervisor.ts';
import eventBusMonitorJob from './event-bus-monitor.ts';

const INFO = '# Server\r\nredis_version:7.2.4\r\n# Memory\r\nmaxmemory_policy:noeviction\r\n';

type Plan = { status: 'ready' | 'wait'; firstConnectFails?: boolean };

/** Lo justo que BullMQ 5.13 toca al construir Queue y Worker y al consumir. */
class FakeRedis extends EventEmitter {
  status: string;
  options: Record<string, unknown>;
  connectAttempts = 0;

  constructor(
    private readonly plan: Plan,
    private readonly duplicates: Plan[],
    options: Record<string, unknown> = {},
  ) {
    super();
    this.status = plan.status;
    this.options = options;
  }

  duplicate(override: Record<string, unknown> = {}): FakeRedis {
    const plan = this.duplicates.shift() ?? { status: 'wait' as const, firstConnectFails: true };
    return new FakeRedis(plan, this.duplicates, { ...this.options, ...override });
  }

  connect(): Promise<void> {
    this.connectAttempts += 1;
    if (this.plan.firstConnectFails) {
      this.status = 'reconnecting';
      return Promise.reject(new Error('Connection is closed.'));
    }
    this.status = 'ready';
    setImmediate(() => this.emit('ready'));
    return Promise.resolve();
  }

  disconnect(): void {
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

  bzpopmin(): Promise<null> {
    return new Promise((resolve) => setTimeout(() => resolve(null), 20));
  }
}

type ServiceInternals = {
  queue_: unknown;
  bullWorker_: { isRunning(): boolean };
  __hooks: {
    onApplicationStart(): Promise<void>;
    onApplicationPrepareShutdown(): Promise<void>;
  };
};

/**
 * La cola se finge a propósito: medirla de verdad exigiría los scripts lua de
 * BullMQ contra un Redis falso, y lo que este test tiene que probar no es la
 * lectura de la cola (eso ya lo cubre `event-bus-health.test.ts`) sino que el
 * monitor ENCUENTRE al supervisor. Cola vacía = el caso de producción.
 */
const emptyQueue = {
  getJobCounts: () => Promise.resolve({ wait: 0, prioritized: 0, active: 0, delayed: 0 }),
  getJobs: () => Promise.resolve([]),
};

const logs: string[] = [];
const logger = {
  info: (message: string) => void logs.push(`info ${message}`),
  warn: (message: string) => void logs.push(`warn ${message}`),
  error: (message: string) => void logs.push(`error ${message}`),
  debug: () => undefined,
  log: () => undefined,
};

/**
 * `resolve` despacha por la forma de la llamada y no por la clave: bajo el loader
 * de tests los símbolos de `@medusajs/framework/utils` son proxies y su valor no
 * es comparable. La única llamada del monitor que pasa opciones es la del event
 * bus (`{ allowUnregistered: true }`); la otra es la del logger.
 */
function containerReturning(eventBusService: unknown): { resolve: (key: unknown, options?: unknown) => unknown } {
  return {
    resolve: (_key: unknown, options?: unknown) => (options ? eventBusService : logger),
  };
}

const previousEnv = {
  redisUrl: process.env.REDIS_URL,
  disableRedis: process.env.DISABLE_REDIS,
  email: process.env.EVENT_BUS_MONITOR_EMAIL,
  min: process.env.EVENT_BUS_WORKER_RESTART_MIN_MS,
  max: process.env.EVENT_BUS_WORKER_RESTART_MAX_MS,
};

let service: ServiceInternals;

before(async () => {
  process.env.REDIS_URL = 'redis://fake:6379';
  delete process.env.DISABLE_REDIS;
  // Sin esto el job intenta resolver el módulo de notificaciones y mandar el mail.
  process.env.EVENT_BUS_MONITOR_EMAIL = 'false';
  // Backoff largo: el worker tiene que seguir apagado cuando corre el monitor.
  process.env.EVENT_BUS_WORKER_RESTART_MIN_MS = '30000';
  process.env.EVENT_BUS_WORKER_RESTART_MAX_MS = '30000';
  delete process.env.EVENT_BUS_WORKER_SUPERVISOR;
  resetLiveEventBusWorkerSupervisor();

  // Todas las conexiones bloqueantes fallan: el worker queda envenenado y el
  // supervisor, esperando su backoff. Es el estado del 15:48:26.
  const connection = new FakeRedis({ status: 'ready' }, []);
  const Service = moduleDefinition.service as new (...args: unknown[]) => ServiceInternals;
  service = new Service(
    {
      logger,
      eventBusRedisConnection: connection,
      eventBusRedisQueueName: 'events-queue',
      eventBusRedisQueueOptions: {},
      eventBusRedisWorkerOptions: { skipStalledCheck: true, drainDelay: 0.05, runRetryDelay: 20 },
      eventBusRedisJobOptions: {},
    },
    {},
    { worker_mode: 'shared' },
  );

  await service.__hooks.onApplicationStart();
  // El `run()` del worker envenenado tiene que haber rechazado antes de medir.
  const deadline = Date.now() + 3000;
  while (service.bullWorker_.isRunning()) {
    if (Date.now() > deadline) throw new Error('el worker envenenado nunca se apagó');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
});

after(async () => {
  await service.__hooks.onApplicationPrepareShutdown();
  resetLiveEventBusWorkerSupervisor();
  process.env.REDIS_URL = previousEnv.redisUrl;
  if (previousEnv.disableRedis === undefined) delete process.env.DISABLE_REDIS;
  else process.env.DISABLE_REDIS = previousEnv.disableRedis;
  if (previousEnv.email === undefined) delete process.env.EVENT_BUS_MONITOR_EMAIL;
  else process.env.EVENT_BUS_MONITOR_EMAIL = previousEnv.email;
  process.env.EVENT_BUS_WORKER_RESTART_MIN_MS = previousEnv.min;
  process.env.EVENT_BUS_WORKER_RESTART_MAX_MS = previousEnv.max;
});

test('con el supervisor vivo pero fuera del servicio resuelto, el aviso lo encuentra igual', async () => {
  logs.length = 0;

  // La copia de propiedades propias: el getter `workerSupervisor` no viaja.
  const asContainerHandsIt = { ...(service as unknown as Record<string, unknown>), queue_: emptyQueue };
  assert.equal(
    (asContainerHandsIt as { workerSupervisor?: unknown }).workerSupervisor,
    undefined,
    'el escenario no reproduce nada: el objeto todavía expone el supervisor',
  );

  await eventBusMonitorJob(containerReturning(asContainerHandsIt) as never);

  const alert = logs.find((line) => line.includes('EL EVENT BUS NO ESTÁ CONSUMIENDO'));
  assert.ok(alert, `el monitor no avisó del worker apagado. Logs:\n${logs.join('\n')}`);
  assert.match(
    alert,
    /Supervisor del worker: /,
    'el aviso no dice en qué anda el supervisor, que es lo que distingue un parpadeo de un segundo de una caída de tres días',
  );

  const rearm = logs.find((line) => line.includes('Re-arme:'));
  assert.ok(rearm, 'el monitor no dejó rastro del re-arme');
  assert.doesNotMatch(
    rearm,
    /módulo de Medusa sin envolver/,
    'sigue diciendo que el módulo no está envuelto con el supervisor corriendo en este mismo proceso',
  );
});

test('sin supervisor publicado, el diagnóstico de "módulo sin envolver" se mantiene', async () => {
  // El fallback no puede tapar el caso real que ese texto describe: una
  // instalación que apunta `event_bus` al paquete pelado de Medusa.
  resetLiveEventBusWorkerSupervisor();

  // Un tick sano primero. El throttle del monitor silencia el mismo `kind` por 30
  // minutos, así que sin esto el segundo aviso no sale y el test mide el throttle
  // en vez de lo que quiere medir. Un veredicto `ok` es lo que lo reinicia — y de
  // paso deja probado ese camino.
  await eventBusMonitorJob(
    containerReturning({ queue_: emptyQueue, bullWorker_: { isRunning: () => true } }) as never,
  );

  logs.length = 0;

  const bare = {
    queue_: emptyQueue,
    bullWorker_: { isRunning: () => false },
  };
  await eventBusMonitorJob(containerReturning(bare) as never);

  const rearm = logs.find((line) => line.includes('Re-arme:'));
  assert.ok(rearm, 'el monitor no dejó rastro del re-arme');
  assert.match(rearm, /módulo de Medusa sin envolver/);
});
