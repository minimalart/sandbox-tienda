/**
 * Event bus sobre Redis con el worker SUPERVISADO.
 *
 * Es el `@medusajs/event-bus-redis` de Medusa, tal cual, con una sola diferencia:
 * si el consumidor de BullMQ muere, se reconstruye solo. El porqué completo —el
 * bug de Medusa, la lectura del código instalado y las tres caídas de producción—
 * está en `lib/event-bus-worker-supervisor.ts`. Este archivo es sólo el cableado
 * entre ese supervisor y el servicio de Medusa, y las cuatro decisiones de abajo
 * son las que hacen que sea un envoltorio y no un fork.
 *
 * ── 1. SE HEREDA EL SERVICIO REAL, NO SE COPIA ──────────────────────────────
 *
 * La clase viene de `@medusajs/medusa/event-bus-redis` (el alias que
 * `medusa-config.ts` usaba hasta ahora, y una dependencia directa del backend:
 * `@medusajs/event-bus-redis`, `bullmq` e `ioredis` NO lo son, y con pnpm no se
 * pueden importar desde acá). Emit, agrupado de eventos, reintentos por
 * subscriber, hooks de shutdown: todo sigue siendo de Medusa y se actualiza con
 * Medusa. Lo único que se pisa es `__hooks.onApplicationStart`, que es donde el
 * paquete hace el `run()` único y sin reintento.
 *
 * ── 2. EL PREFIJO DE LA COLA SE FIJA A MANO ──────────────────────────────────
 *
 * Medusa arma las claves de Redis con `prefix: ${this.constructor.name}`
 * (`event-bus-redis.js:121,128`), o sea `RedisEventBusService:events-queue:*`.
 * Heredar cambia `constructor.name`, y con él el namespace ENTERO de la cola: los
 * eventos que quedaron encolados durante el deploy (una `order.placed` emitida por
 * la instancia vieja un segundo antes de morir) quedarían huérfanos en el prefijo
 * viejo, sin nadie que los consuma. Por eso el prefijo se pasa explícito en las
 * opciones de la Queue Y del Worker —las dos, porque el servicio las arma por
 * separado— y deja de depender del nombre de ninguna clase.
 *
 * ── 3. NO SE AGREGA NINGUNA DEPENDENCIA ─────────────────────────────────────
 *
 * Construir un Worker nuevo necesita la clase `Worker` de BullMQ, y `bullmq` no
 * es dependencia directa (ver `jobs/event-bus-monitor.ts` para el costo de
 * agregarla: lockfile frágil, `package-lock` del deploy, PAT). Se toma del worker
 * que Medusa ya construyó: `worker.constructor` ES la clase `Worker`, de la MISMA
 * copia de `bullmq` que usa el paquete — que es además la única garantía de que el
 * worker nuevo sea idéntico al original.
 *
 * ── 4. NO SE EXPORTA `discoveryPath` ────────────────────────────────────────
 *
 * Si este módulo exportara `discoveryPath`, el cargador de Medusa
 * (`modules-sdk/dist/loaders/utils/load-internal.js:23-28`) importaría el módulo
 * apuntado por ese path y usaría SU `service` en lugar del de acá: el envoltorio
 * quedaría registrado y nunca ejecutado. Sin ese export, `discoveryPath` es este
 * archivo, y como la carpeta no tiene `models/`, `services/` ni `migrations/`, la
 * auto-carga de recursos no encuentra nada, que es lo correcto para un event bus.
 *
 * Se apaga sin tocar código con `EVENT_BUS_WORKER_SUPERVISOR=false` (vuelve el
 * `run()` único de Medusa). El backoff se ajusta con
 * `EVENT_BUS_WORKER_RESTART_MIN_MS` / `EVENT_BUS_WORKER_RESTART_MAX_MS`.
 */

import type { Logger, ModuleExports } from '@medusajs/framework/types';
import * as eventBusRedisPackage from '@medusajs/medusa/event-bus-redis';
import {
  DEFAULT_MAX_DELAY_MS,
  DEFAULT_MIN_DELAY_MS,
  EventBusWorkerSupervisor,
  type EventBusWorkerSupervisorLike,
  type SupervisedWorker,
} from '../../lib/event-bus-worker-supervisor';

/**
 * El prefijo con el que Medusa venía creando la cola: el nombre de SU clase. Es
 * un dato de la instalación (así están las claves en el Redis de producción), no
 * una elección de estilo. Ver la decisión 2 de arriba antes de tocarlo.
 */
export const EVENT_BUS_QUEUE_PREFIX = 'RedisEventBusService';

/** Cada cuánto se repite en el log el MISMO error del worker de BullMQ. */
const WORKER_ERROR_LOG_TTL_MS = 60_000;

type WorkerEvents = {
  on?: (event: 'error', listener: (error: unknown) => void) => unknown;
};

type BullWorker = SupervisedWorker & WorkerEvents;

type BullWorkerConstructor = new (
  queueName: string,
  processor: unknown,
  options: Record<string, unknown>,
) => BullWorker;

type EventBusHooks = {
  onApplicationStart?: () => Promise<void>;
  onApplicationShutdown?: () => Promise<void>;
  onApplicationPrepareShutdown?: () => Promise<void>;
};

/**
 * Los campos del servicio de Medusa que este módulo lee o pisa. Tipados a mano
 * porque el paquete exporta la clase como `Constructor<any>` y sus `.d.ts`
 * dependen de `bullmq`/`ioredis`, que no resuelven desde acá. Si Medusa renombra
 * alguno, el test de integración (`index.test.ts`) lo va a decir.
 */
type RedisEventBusServiceInternals = {
  logger_: Logger;
  eventBusRedisConnection_: unknown;
  queueName_: string;
  worker_: unknown;
  workerOptions_: Record<string, unknown>;
  bullWorker_?: BullWorker;
  __hooks: EventBusHooks;
};

/** Lo que el loader de Medusa registra en el container del módulo. */
type RedisEventBusDependencies = {
  logger: Logger;
  eventBusRedisConnection: unknown;
  eventBusRedisQueueName?: string;
  eventBusRedisQueueOptions?: Record<string, unknown>;
  eventBusRedisWorkerOptions?: Record<string, unknown>;
  eventBusRedisJobOptions?: Record<string, unknown>;
};

type RedisEventBusServiceConstructor = new (
  dependencies: RedisEventBusDependencies,
  moduleOptions: unknown,
  moduleDeclaration: unknown,
) => RedisEventBusServiceInternals;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const envMs = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * El paquete es CommonJS con `exports.default = { service, loaders }`. Compilado
 * (producción, `medusa build`) llega como `{ default }`; bajo el runner ESM de
 * `node --test` llega como `{ default: { default } }`, porque Node expone
 * `module.exports` entero como default. Se baja por `.default` hasta encontrar el
 * objeto con `service`, y si no aparece se corta el arranque con un mensaje que
 * dice qué cambió: registrar un event bus sin servicio sería fallar en silencio.
 */
function unwrapModuleExports(candidate: unknown): ModuleExports {
  let current: unknown = candidate;
  for (let depth = 0; depth < 3; depth += 1) {
    if (current && typeof current === 'object' && 'service' in current) {
      return current as ModuleExports;
    }
    current = current && typeof current === 'object' ? (current as { default?: unknown }).default : undefined;
  }
  throw new Error(
    '[event-bus-redis] @medusajs/medusa/event-bus-redis ya no expone { service, loaders }: ' +
      'cambió el paquete y este envoltorio no puede heredar de su servicio.',
  );
}

const core = unwrapModuleExports(eventBusRedisPackage);
const CoreRedisEventBusService = core.service as RedisEventBusServiceConstructor;

export class SupervisedRedisEventBusService extends CoreRedisEventBusService {
  private workerSupervisor_: EventBusWorkerSupervisor | null = null;
  private readonly workerErrorsLogged_ = new Map<string, number>();

  constructor(
    dependencies: RedisEventBusDependencies,
    moduleOptions: unknown,
    moduleDeclaration: unknown,
  ) {
    // `dependencies` es el cradle de awilix (un Proxy): se leen SÓLO las claves que
    // el servicio usa. Spreadearlo resolvería cada registro del container, incluido
    // `event_bus` — o sea este mismo servicio, a mitad de construirse.
    super(
      {
        logger: dependencies.logger,
        eventBusRedisConnection: dependencies.eventBusRedisConnection,
        eventBusRedisQueueName: dependencies.eventBusRedisQueueName,
        eventBusRedisQueueOptions: {
          prefix: EVENT_BUS_QUEUE_PREFIX,
          ...dependencies.eventBusRedisQueueOptions,
        },
        eventBusRedisWorkerOptions: {
          prefix: EVENT_BUS_QUEUE_PREFIX,
          ...dependencies.eventBusRedisWorkerOptions,
        },
        eventBusRedisJobOptions: dependencies.eventBusRedisJobOptions,
      },
      moduleOptions,
      moduleDeclaration,
    );

    // El worker inicial nace acá, segundos antes de `onApplicationStart`: si su
    // conexión falla en ese hueco, el error tiene que pasar por el logger igual.
    if (this.bullWorker_) this.logWorkerErrors(this.bullWorker_);

    const coreHooks = this.__hooks;
    this.__hooks = {
      ...coreHooks,
      onApplicationStart: async () => {
        this.startWorkerSupervisor();
      },
      onApplicationPrepareShutdown: async () => {
        // Primero se le avisa al supervisor: el `close()` de Medusa hace resolver
        // a `run()`, y sin este orden el loop lo leería como una muerte más.
        this.workerSupervisor_?.stop();
        await coreHooks.onApplicationPrepareShutdown?.();
      },
    };
  }

  /** Para el monitor (`jobs/event-bus-monitor.ts`): `null` si este proceso no consume. */
  get workerSupervisor(): EventBusWorkerSupervisorLike | null {
    return this.workerSupervisor_;
  }

  private startWorkerSupervisor(): void {
    const worker = this.bullWorker_;
    // Sin worker en este proceso (worker_mode = server) no hay nada que vigilar.
    if (!worker || this.workerSupervisor_) return;

    if (process.env.EVENT_BUS_WORKER_SUPERVISOR === 'false') {
      this.logger_.warn(
        '[event-bus-redis] Supervisor del worker APAGADO por EVENT_BUS_WORKER_SUPERVISOR=false: ' +
          'si run() rechaza, el event bus queda mudo hasta un reinicio (comportamiento de Medusa).',
      );
      void worker.run().catch((error: unknown) => {
        this.logger_.error(`Error running event bus worker: ${messageOf(error)}`);
      });
      return;
    }

    const WorkerClass = worker.constructor as BullWorkerConstructor;
    this.workerSupervisor_ = new EventBusWorkerSupervisor({
      worker,
      // Calcado de `event-bus-redis.js:127-132`: la misma cola, el mismo handler
      // (`worker_`, que ya conoce a los subscribers) y las mismas opciones.
      createWorker: () =>
        new WorkerClass(this.queueName_, this.worker_, {
          prefix: EVENT_BUS_QUEUE_PREFIX,
          ...this.workerOptions_,
          connection: this.eventBusRedisConnection_,
          autorun: false,
        }),
      onWorker: (next, origin) => {
        // El worker vigente tiene que ser el que Medusa cierra en el shutdown y el
        // que el monitor mide: por eso se pisa la referencia del servicio.
        this.bullWorker_ = next;
        if (origin === 'rebuilt') this.logWorkerErrors(next);
      },
      logger: this.logger_,
      minDelayMs: envMs('EVENT_BUS_WORKER_RESTART_MIN_MS', DEFAULT_MIN_DELAY_MS),
      maxDelayMs: envMs('EVENT_BUS_WORKER_RESTART_MAX_MS', DEFAULT_MAX_DELAY_MS),
    });
    this.workerSupervisor_.start();
  }

  /**
   * Medusa no le cuelga ningún listener de `error` al Worker, así que los errores
   * de conexión de BullMQ caían en un `console.error` de emergencia, fuera del
   * logger y sin freno. Acá pasan por el logger con throttle por mensaje: durante
   * una caída de Redis el mismo error se repite cada pocos segundos.
   */
  private logWorkerErrors(worker: BullWorker): void {
    if (typeof worker.on !== 'function') return;
    worker.on('error', (error: unknown) => {
      const message = messageOf(error);
      const now = Date.now();
      const last = this.workerErrorsLogged_.get(message);
      if (last !== undefined && now - last < WORKER_ERROR_LOG_TTL_MS) return;
      if (this.workerErrorsLogged_.size > 100) this.workerErrorsLogged_.clear();
      this.workerErrorsLogged_.set(message, now);
      this.logger_.warn(`[event-bus-redis] El worker de BullMQ reportó un error: ${message}`);
    });
  }
}

const moduleDefinition: ModuleExports = {
  service: SupervisedRedisEventBusService,
  loaders: core.loaders,
};

export default moduleDefinition;
