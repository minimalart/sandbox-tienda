/**
 * Supervisor del Worker de BullMQ que CONSUME el event bus.
 *
 * ── EL BUG QUE CIERRA ────────────────────────────────────────────────────────
 *
 * `@medusajs/event-bus-redis@2.18.0` arranca el consumidor UNA vez, en
 * `onApplicationStart` (`dist/services/event-bus-redis.js:21`):
 *
 *     void this.bullWorker_.run().catch((error) => {
 *       this.logger_.error(`Error running event bus worker: ${error.message}`, error)
 *     })
 *
 * Si esa promesa rechaza, se loguea UNA línea y nadie vuelve a arrancar el worker.
 * El proceso sigue vivo, el HTTP responde, los crons corren, y el bus queda mudo
 * hasta el próximo deploy: sin mails de orden, sin WhatsApp, sin outbox del ERP.
 * Pasó el 2026-08-31 (tres días, 5.343 eventos encolados), el 2026-09-03 y el
 * 2026-09-09 (~50 minutos), siempre con la misma línea en el log:
 *
 *     Error running event bus worker: Connection is closed.
 *       at EventEmitter.connectionCloseHandler (ioredis/built/Redis.js:220)
 *
 * ── POR QUÉ RECHAZA, LEÍDO EN EL CÓDIGO INSTALADO ───────────────────────────
 *
 * BullMQ consume con un comando bloqueante sobre una SEGUNDA conexión que
 * DUPLICA de la de Medusa (`bullmq@5.13.0 worker.js:105-107`,
 * `opts.connection.duplicate(...)`). El duplicado hereda `lazyConnect: true` del
 * loader de Medusa (`event-bus-redis/dist/loaders/index.js:19`), así que nace en
 * estado `wait`, y `RedisConnection.waitUntilReady` (`redis-connection.js:82`)
 * lo conecta con `client.connect()`. Esa promesa de ioredis RECHAZA si el PRIMER
 * intento cierra antes de llegar a `ready` (`Redis.js:218-220`): un handshake TLS
 * que agota `connectTimeout`, un `ECONNRESET`, un Valkey al tope de conexiones
 * durante un deploy. ioredis sigue reintentando por detrás y el socket termina
 * sano, pero BullMQ ya guardó el rechazo en `initializing` (`redis-connection.js:61`)
 * y esa promesa es la que devuelve `get client()` PARA SIEMPRE. `run()` hace
 * `await this.blockingConnection.client` (`worker.js:179`) y rechaza con el mismo
 * `Connection is closed.` hoy, mañana y en cada reintento sobre ESE Worker.
 *
 * Eso explica lo que el monitor midió el 2026-09-09: la conexión principal en
 * `ready`, el Valkey sano, y `run()` fallando igual en cada tick. No era la infra:
 * era un objeto envenenado. La cura es CONSTRUIR UN WORKER NUEVO (que duplica una
 * conexión nueva) después de cerrar el muerto (que libera la suya): cero conexiones
 * netas, así que funciona aunque el Valkey esté al límite de su plan.
 *
 * ── QUÉ HACE ESTO ───────────────────────────────────────────────────────────
 *
 *   1. Arranca `run()` y se queda esperándolo. `run()` sólo resuelve cuando el
 *      worker se CIERRA, así que "esperarlo" es vigilarlo.
 *   2. Si rechaza (o resuelve sin que nadie lo haya detenido), espera un backoff
 *      exponencial (1 s → 60 s), cierra el worker muerto con `close(true)` y le
 *      pide uno nuevo a la fábrica. Para siempre: no hay tope de reintentos porque
 *      rendirse es exactamente el comportamiento que se está reemplazando.
 *   3. Cada reconstrucción queda en el log a nivel `error`, y la recuperación a
 *      nivel `info`. Un auto-arreglo silencioso es cómo un problema recurrente se
 *      vuelve invisible — y éste ya vive de ser invisible.
 *
 * Es infraestructura pura: no importa BullMQ ni Medusa. Recibe el worker, una
 * fábrica y un logger, y se testea con dobles (`event-bus-worker-supervisor.test.ts`).
 * El cableado con el módulo real vive en `modules/event-bus-redis/index.ts`, y el
 * monitor (`jobs/event-bus-monitor.ts`) le delega el re-arme vía
 * `requestSupervisorRestart` para que el ciclo de vida del worker tenga UN dueño.
 */

/** Lo mínimo que el supervisor necesita de un `Worker` de BullMQ. */
export type SupervisedWorker = {
  isRunning(): boolean;
  /** Sólo resuelve cuando el worker se cierra. Rechaza si el consumidor no pudo arrancar. */
  run(): Promise<unknown>;
  close(force?: boolean): Promise<unknown>;
  /** Resuelve cuando las DOS conexiones (la normal y la bloqueante) están listas. */
  waitUntilReady?: () => Promise<unknown>;
};

export type SupervisorLogger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

/** Timers inyectables: en producción `setTimeout`/`clearTimeout`; en los tests, una cola manual. */
export type SupervisorTimer = {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

export type WorkerOrigin = 'initial' | 'rebuilt';

export type EventBusWorkerSupervisorOptions = {
  /** El worker que Medusa ya construyó en el constructor del servicio. */
  worker: SupervisedWorker;
  /** Construye un worker NUEVO con la misma cola, el mismo handler y las mismas opciones. */
  createWorker: () => SupervisedWorker;
  /**
   * Se llama con el worker inicial al arrancar y con cada worker reconstruido. El
   * dueño lo usa para apuntar su referencia (`bullWorker_`) al worker vigente y
   * para colgarle listeners.
   */
  onWorker?: (worker: SupervisedWorker, origin: WorkerOrigin) => void;
  logger: SupervisorLogger;
  /** Primer intervalo del backoff. Default 1 s. */
  minDelayMs?: number;
  /** Techo del backoff. Default 60 s. */
  maxDelayMs?: number;
  /** Cuánto se espera a `close(true)` del worker muerto antes de seguir sin él. Default 5 s. */
  closeDeadlineMs?: number;
  timer?: SupervisorTimer;
  now?: () => number;
};

export type SupervisorState =
  /** `start()` todavía no se llamó. */
  | 'idle'
  /** `run()` está en vuelo. Incluye "conectando": BullMQ marca `isRunning()` desde el primer instante. */
  | 'running'
  /** El worker murió y se está esperando el backoff antes de reconstruirlo. */
  | 'waiting'
  | 'stopped';

export type EventBusWorkerSupervisorSnapshot = {
  state: SupervisorState;
  /** Cuántas veces se construyó un worker nuevo. */
  restarts: number;
  /** Fallas seguidas sin una recuperación confirmada en el medio. Gobierna el backoff. */
  consecutiveFailures: number;
  lastError: { message: string; at: number } | null;
  nextRetryAt: number | null;
};

/** Lo que el monitor necesita del supervisor, sin depender de la clase. */
export type EventBusWorkerSupervisorLike = {
  restartNow(): boolean;
  snapshot(): EventBusWorkerSupervisorSnapshot;
};

export const DEFAULT_MIN_DELAY_MS = 1_000;
export const DEFAULT_MAX_DELAY_MS = 60_000;
const DEFAULT_CLOSE_DEADLINE_MS = 5_000;

/**
 * Cuánto esperar cuando el worker figura corriendo en manos de otro (`run()` dice
 * `Worker is already running`, o `isRunning()` da true sin que el supervisor lo
 * haya arrancado). No se pisa y no se cuenta como falla: se vuelve a mirar.
 */
export const FOREIGN_RUN_POLL_MS = 5_000;

const ALREADY_RUNNING = 'already running';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const positive = (value: number | undefined, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

const defaultTimer: SupervisorTimer = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class EventBusWorkerSupervisor implements EventBusWorkerSupervisorLike {
  private worker: SupervisedWorker;
  private readonly createWorker: () => SupervisedWorker;
  private readonly onWorker: ((worker: SupervisedWorker, origin: WorkerOrigin) => void) | undefined;
  private readonly logger: SupervisorLogger;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly closeDeadlineMs: number;
  private readonly timer: SupervisorTimer;
  private readonly now: () => number;

  private state: SupervisorState = 'idle';
  private stopped = false;
  private restarts = 0;
  private consecutiveFailures = 0;
  private lastError: { message: string; at: number } | null = null;
  private nextRetryAt: number | null = null;
  /** Corta la espera en curso (backoff o sondeo). `null` cuando no se está esperando. */
  private wake: (() => void) | null = null;
  private loop: Promise<void> | null = null;

  constructor(options: EventBusWorkerSupervisorOptions) {
    this.worker = options.worker;
    this.createWorker = options.createWorker;
    this.onWorker = options.onWorker;
    this.logger = options.logger;
    this.minDelayMs = positive(options.minDelayMs, DEFAULT_MIN_DELAY_MS);
    this.maxDelayMs = Math.max(positive(options.maxDelayMs, DEFAULT_MAX_DELAY_MS), this.minDelayMs);
    this.closeDeadlineMs = positive(options.closeDeadlineMs, DEFAULT_CLOSE_DEADLINE_MS);
    this.timer = options.timer ?? defaultTimer;
    this.now = options.now ?? Date.now;
  }

  /** Idempotente. NO se awaitea: el loop vive lo que vive el proceso. */
  start(): void {
    if (this.loop) return;
    this.onWorker?.(this.worker, 'initial');
    this.loop = this.supervise().catch((error: unknown) => {
      // El loop no puede morir. Si murió, es un bug del supervisor y hay que verlo.
      this.state = 'stopped';
      this.logger.error(
        `[event-bus-supervisor] El supervisor murió por un error propio: ${messageOf(error)}. ` +
          'El worker del event bus queda sin vigilancia hasta el próximo reinicio.',
      );
    });
  }

  /**
   * Deja de reconstruir. NO cierra el worker: eso lo hace el dueño (el hook
   * `onApplicationPrepareShutdown` de Medusa), que sabe si quiere esperar a los
   * jobs en curso. Cuando ese `close()` haga resolver a `run()`, el loop lo lee
   * como "detenido" y no como "murió".
   */
  stop(): void {
    this.stopped = true;
    this.state = 'stopped';
    this.nextRetryAt = null;
    this.wake?.();
  }

  /**
   * Corta el backoff y reconstruye ya. Devuelve `true` si había una espera que
   * cortar: es lo que el monitor usa cuando detecta el worker apagado.
   */
  restartNow(): boolean {
    if (this.stopped || this.state !== 'waiting' || !this.wake) return false;
    this.wake();
    return true;
  }

  get current(): SupervisedWorker {
    return this.worker;
  }

  snapshot(): EventBusWorkerSupervisorSnapshot {
    return {
      state: this.state,
      restarts: this.restarts,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError ? { ...this.lastError } : null,
      nextRetryAt: this.nextRetryAt,
    };
  }

  private async supervise(): Promise<void> {
    while (!this.stopped) {
      const worker = this.worker;

      if (worker.isRunning()) {
        // Alguien ajeno lo arrancó (un `run()` directo). No se pisa: se vuelve a mirar.
        await this.wait(FOREIGN_RUN_POLL_MS);
        continue;
      }

      this.state = 'running';
      this.nextRetryAt = null;
      const startedAt = this.now();
      if (this.consecutiveFailures > 0) this.confirmRecovery(worker);

      let failure: string;
      try {
        await worker.run();
        if (this.stopped) return;
        failure = 'run() terminó: el worker se cerró por fuera del supervisor';
      } catch (error) {
        if (this.stopped) return;
        const message = messageOf(error);
        if (message.toLowerCase().includes(ALREADY_RUNNING)) {
          await this.wait(FOREIGN_RUN_POLL_MS);
          continue;
        }
        failure = message;
      }

      const lived = this.now() - startedAt;
      const delay = this.registerFailure(failure);
      this.logger.error(
        `[event-bus-supervisor] El worker del event bus murió tras ${lived} ms: ${failure}. ` +
          `Se cierra y se construye uno nuevo en ${delay} ms (falla consecutiva #${this.consecutiveFailures}, ` +
          `reconstrucciones previas: ${this.restarts}). Mientras tanto NO se consumen eventos.`,
      );

      await this.wait(delay);
      if (this.stopped) return;
      await this.replaceWorker();
    }
  }

  /** Cuenta la falla, calcula el backoff y deja el snapshot listo para el monitor. */
  private registerFailure(message: string): number {
    this.consecutiveFailures += 1;
    this.lastError = { message, at: this.now() };
    const exponent = Math.min(this.consecutiveFailures - 1, 30);
    const delay = Math.min(this.maxDelayMs, this.minDelayMs * 2 ** exponent);
    this.nextRetryAt = this.now() + delay;
    this.state = 'waiting';
    return delay;
  }

  /**
   * Cierra el worker muerto y construye uno nuevo. Si la fábrica falla se
   * reintenta con backoff: NUNCA se queda apuntando a un worker cerrado, porque
   * `run()` sobre uno cerrado resuelve en el acto y el loop giraría en vano.
   */
  private async replaceWorker(): Promise<void> {
    await this.closeQuietly(this.worker);
    while (!this.stopped) {
      try {
        const next = this.createWorker();
        this.worker = next;
        this.restarts += 1;
        this.onWorker?.(next, 'rebuilt');
        return;
      } catch (error) {
        const message = messageOf(error);
        const delay = this.registerFailure(`construir el worker nuevo falló: ${message}`);
        this.logger.error(
          `[event-bus-supervisor] Construir un worker nuevo falló: ${message}. Se reintenta en ${delay} ms.`,
        );
        await this.wait(delay);
      }
    }
  }

  /**
   * `close(true)` suelta la conexión bloqueante del worker muerto (`disconnect()`
   * de ioredis, que además frena su loop de reconexión). Es lo que mantiene el
   * saldo de conexiones en cero cuando se construye el nuevo. Se acota en tiempo
   * porque un `close()` colgado no puede colgar la recuperación.
   */
  private async closeQuietly(worker: SupervisedWorker): Promise<void> {
    try {
      const closed = await this.withDeadline(worker.close(true), this.closeDeadlineMs);
      if (!closed) {
        this.logger.warn(
          `[event-bus-supervisor] close(true) del worker muerto no terminó en ${this.closeDeadlineMs} ms; ` +
            'se sigue con uno nuevo igual.',
        );
      }
    } catch (error) {
      this.logger.warn(
        `[event-bus-supervisor] close(true) del worker muerto falló (${messageOf(error)}); ` +
          'se sigue con uno nuevo igual.',
      );
    }
  }

  /**
   * "Recuperado" no es "run() no rechazó todavía": BullMQ marca `isRunning()` en
   * el primer instante, mientras todavía espera a Redis. La señal real es
   * `waitUntilReady()`, que resuelve cuando las dos conexiones están listas. Si en
   * cambio rechaza, el loop ya lo va a ver como rechazo de `run()`; y si queda
   * pendiente (Redis caído), no hay nada que declarar.
   */
  private confirmRecovery(worker: SupervisedWorker): void {
    if (typeof worker.waitUntilReady !== 'function') return;
    const failures = this.consecutiveFailures;
    worker.waitUntilReady().then(
      () => {
        if (this.stopped || this.worker !== worker) return;
        this.consecutiveFailures = 0;
        this.logger.info(
          `[event-bus-supervisor] RECUPERADO: el worker del event bus volvió a conectarse tras ` +
            `${failures} falla(s) y ${this.restarts} reconstrucción(es).`,
        );
      },
      () => undefined,
    );
  }

  /** Espera `ms`, salvo que `stop()` o `restartNow()` la corten antes. */
  private wait(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      let handle: unknown = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (handle !== null) this.timer.clear(handle);
        if (this.wake === finish) this.wake = null;
        resolve();
      };
      this.wake = finish;
      handle = this.timer.set(finish, ms);
    });
  }

  /** `true` si la promesa resolvió a tiempo, `false` si venció el plazo. Propaga rechazos. */
  private withDeadline(promise: Promise<unknown>, ms: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      const handle = this.timer.set(() => {
        if (settled) return;
        settled = true;
        resolve(false);
      }, ms);
      promise.then(
        () => {
          if (settled) return;
          settled = true;
          this.timer.clear(handle);
          resolve(true);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          this.timer.clear(handle);
          reject(error);
        },
      );
    });
  }
}

/** Una línea con el estado del supervisor, para el log y el mail del monitor. */
export function describeSupervisor(
  snapshot: EventBusWorkerSupervisorSnapshot,
  now: number = Date.now(),
): string {
  const parts = [
    `estado=${snapshot.state}`,
    `reconstrucciones=${snapshot.restarts}`,
    `fallas_consecutivas=${snapshot.consecutiveFailures}`,
  ];
  if (snapshot.lastError) {
    const ago = Math.max(0, Math.round((now - snapshot.lastError.at) / 1000));
    parts.push(`ultimo_error=${JSON.stringify(snapshot.lastError.message)} (hace ${ago} s)`);
  }
  if (snapshot.nextRetryAt !== null) {
    const wait = Math.max(0, Math.round((snapshot.nextRetryAt - now) / 1000));
    parts.push(`proximo_reintento_en=${wait} s`);
  }
  return parts.join(' ');
}

/**
 * Lo que el monitor hace cuando encuentra el worker apagado y el servicio expone
 * un supervisor: pedirle que corte el backoff, en vez de llamar a `run()` por su
 * cuenta sobre un worker que puede estar envenenado. `handled: false` significa
 * que el supervisor no estaba esperando (o no existe) y el monitor debe caer a su
 * re-arme directo de siempre.
 */
export function requestSupervisorRestart(
  supervisor: EventBusWorkerSupervisorLike | null | undefined,
  now: number = Date.now(),
): { handled: boolean; line: string } {
  if (!supervisor) {
    return {
      handled: false,
      line: 'el servicio de event bus no expone supervisor del worker (módulo de Medusa sin envolver).',
    };
  }
  const before = describeSupervisor(supervisor.snapshot(), now);
  const woke = supervisor.restartNow();
  return {
    handled: woke,
    line: woke
      ? `el supervisor del worker está a cargo (${before}); se le pidió reconstruir AHORA en vez de esperar el backoff.`
      : `el supervisor del worker existe pero no estaba esperando (${before}); se cae al re-arme directo.`,
  };
}
