/**
 * Vigilancia del CONSUMIDOR del event bus.
 *
 * El 2026-08-31 21:35:33 se cortaron en el MISMO segundo las notificaciones por
 * event bus, el outbox del ERP y el WhatsApp de una tienda en producción, y
 * estuvieron TRES DÍAS sin volver: seis órdenes sin mail, sin WhatsApp y sin
 * llegar al ERP. El aviso llegó por Slack, de una usuaria.
 *
 * ── POR QUÉ ESTO ES UN JOB Y NO UN HEALTHCHECK HTTP ──────────────────────────
 *
 * Porque durante esos tres días TODO lo que se mira estuvo verde. El proceso
 * nunca se cayó: el cron de Typesense corrió cada 15 minutos sin un solo hueco y
 * los `cart-abandoned` —que salen de un job, no del bus— siguieron saliendo. El
 * puerto respondía, el contenedor no se reinició, los crons cumplieron.
 *
 * Ese contraste no es una anécdota: es el DISEÑO del fix. Está comprobado que los
 * jobs SOBREVIVEN a esta falla exacta, así que el job es el único lugar del
 * proceso desde el cual se puede observar el bus con alguna garantía. Y por el
 * mismo motivo el canal de aviso no puede pasar por el bus: si el bus está muerto,
 * un `emit` de alerta se encola al lado de las órdenes que nadie está consumiendo.
 *
 * ── LOS DOS MECANISMOS QUE PUEDEN HABERLO CAUSADO ────────────────────────────
 *
 * No se pudo confirmar cuál de los dos fue, y este archivo NO decide por ninguno:
 * detecta los dos, con señales distintas.
 *
 *   A. Un subscriber colgado ocupando el único slot. `medusa-config.ts` no pasaba
 *      `workerOptions`, así que BullMQ corría con `concurrency: 1` y un solo
 *      subscriber que no resuelve congela la instalación entera. Ya está
 *      arreglado en otro PR (concurrencia > 1), lo que baja la probabilidad pero
 *      NO la elimina: con concurrencia 10, diez subscribers colgados hacen lo
 *      mismo. La señal de A es un job ACTIVO desde hace demasiado.
 *
 *   B. El `run()` del worker murió. En `@medusajs/event-bus-redis@2.18.0`,
 *      `dist/services/event-bus-redis.js:21`:
 *
 *          void this.bullWorker_.run().catch((error) => {
 *            this.logger_.error(`Error running event bus worker: ${error.message}`, error)
 *          })
 *
 *      Si esa promesa rechaza, se loguea UNA línea y no se vuelve a arrancar
 *      nunca. El proceso sigue vivo, el HTTP sigue sano, los crons siguen
 *      corriendo, y el bus queda mudo para siempre. La señal de B es directa:
 *      `Worker#run()` pone `this.running = false` en su `catch` antes de
 *      relanzar (`bullmq@5.13.0 worker.js:226-230`), así que `isRunning()` da
 *      `false` mientras el proceso sigue en pie.
 *
 * ── POR QUÉ LA SEÑAL ES LA ANTIGÜEDAD Y NO LA PROFUNDIDAD ────────────────────
 *
 * La profundidad de la cola sola NO alcanza, y esto es lo más importante de todo
 * el archivo:
 *
 *   - `depth === 0` es AMBIGUO. Puede ser "el consumidor está al día" o puede ser
 *     "no se emitió nada". Un monitor que da verde con 0 da verde de madrugada
 *     aunque el worker esté muerto desde ayer.
 *   - `depth > 0` también es ambiguo. Un pico de importación deja 3.000 eventos
 *     encolados un rato y eso es SALUD, no falla.
 *
 * La antigüedad del pendiente más viejo no es ambigua: es una medición directa de
 * la latencia del consumidor, y es MONÓTONA — sólo crece mientras nadie consume.
 * En esta instalación un evento se procesa en milisegundos; uno encolado hace diez
 * minutos no se explica por carga. Ése es el umbral (`stallMs`).
 *
 * ── DÓNDE ESPERAN DE VERDAD LOS EVENTOS: `prioritized`, NO `wait` ────────────
 *
 * Trampa cara y silenciosa. `buildEvents` le pone SIEMPRE una prioridad a cada
 * evento (`EventPriority.DEFAULT` = 100, o `LOWEST` para los internos), y BullMQ
 * manda todo job con prioridad al ZSET `prioritized` en vez de a la lista `wait`
 * (`bullmq@5.13.0 commands/includes/addJobWithPriority.lua`). O sea que
 * `getWaitingCount()` en esta instalación da 0 SIEMPRE, con el bus sano y con el
 * bus muerto. Un monitor escrito contra `wait` habría dado verde los tres días.
 *
 * Por eso se leen las tres poblaciones: `wait` (por si algún emisor manda sin
 * prioridad), `prioritized` (donde caen los de Medusa) y `active` (donde queda
 * clavado el mecanismo A).
 */

/** Lo mínimo que este monitor le pide a una `bullmq.Queue`. Tipado a mano para no
 *  hacer de `bullmq` una dependencia directa de la app: ver la nota de
 *  `jobs/event-bus-monitor.ts` sobre por qué no se agrega la dep. */
export type EventBusJobLike = {
  name?: string;
  timestamp?: number;
  processedOn?: number | null;
};

export type EventBusQueueLike = {
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
  getJobs(
    types: string[],
    start?: number,
    end?: number,
    asc?: boolean,
  ): Promise<Array<EventBusJobLike | null | undefined>>;
};

export type EventBusWorkerLike = {
  isRunning(): boolean;
  /**
   * Volver a arrancar el consumidor. OPCIONAL a propósito: el tipo describe lo que
   * necesitamos de un objeto ajeno (el `Worker` de BullMQ que vive adentro del
   * provider de Medusa), no lo que ese objeto promete. Si algún día no está, el
   * monitor sigue midiendo y avisando; lo único que se pierde es el auto-arranque.
   *
   * NO SE PUEDE AWAITEAR. `Worker#run()` devuelve una promesa que sólo resuelve
   * cuando el worker se CIERRA: esperarla colgaría el job para siempre. Se dispara
   * y se verifica en el tick siguiente, que es justamente lo que el monitor ya hace.
   */
  run?: () => Promise<unknown>;
  /**
   * La conexión de ioredis que el Worker usa para consumir, tal como BullMQ la
   * expone (`QueueBase#client`, una promesa que resuelve cuando está lista).
   *
   * OPCIONAL por el mismo motivo que `run`: es interior de un paquete ajeno.
   *
   * ES UNA PROMESA QUE PUEDE NO RESOLVER NUNCA. Si la conexión no logra
   * establecerse, BullMQ deja ese `client` pendiente para siempre: awaitearlo sin
   * techo de tiempo cuelga a quien lo espere, o sea que el monitor se convertiría
   * en la falla que vigila. Todo consumo de esto va con deadline.
   */
  client?: Promise<EventBusRedisClientLike>;
  /**
   * LA CONEXIÓN QUE SE MUERE, y no es la de arriba.
   *
   * BullMQ abre DOS: la normal y una que DUPLICA para el comando bloqueante con
   * el que consume (`worker.js:120` → `opts.connection.duplicate(...)`). La
   * segunda es la que se cayó en desdeelsur el 2026-09-09, y el monitor lo dejó
   * probado por accidente: reportó `Conexión: en \`ready\`, no hace falta
   * tocarla` —mirando `client`— y en la misma línea `run()` falló con
   * `Connection is closed.`. Revivir la conexión equivocada no cuesta un error:
   * cuesta un diagnóstico que dice "está todo bien" mientras nada funciona.
   *
   * `reconnect()` es de BullMQ (`redis-connection.js:394`) y hace lo correcto:
   * mira el `status` y sólo llama a `connect()` si quedó en `wait` o `end`. Pero
   * arranca con `await this.client`, así que TAMBIÉN necesita techo de tiempo.
   */
  blockingConnection?: EventBusRedisConnectionLike;
};

/** Lo mínimo que necesitamos de una `RedisConnection` de BullMQ. */
export type EventBusRedisConnectionLike = {
  client?: Promise<EventBusRedisClientLike>;
  reconnect?: () => Promise<unknown>;
};

/**
 * Lo mínimo que necesitamos del cliente de ioredis para saber si la conexión está
 * viva y, si no, reabrirla.
 *
 * `status` es el estado público de ioredis (`wait`, `connecting`, `connect`,
 * `ready`, `reconnecting`, `close`, `end`). `connect()` reabre el MISMO socket
 * cuando quedó en `end` — no crea un cliente nuevo, y eso es exactamente por qué
 * se usa ésta y no la construcción de un Worker nuevo: contra un Valkey que está
 * rechazando conexiones por tope de plan, abrir clientes nuevos cada cinco
 * minutos empuja en la dirección del problema.
 */
export type EventBusRedisClientLike = {
  status?: string;
  connect?: () => Promise<unknown>;
};

/**
 * Cuántos jobs se traen para medir la antigüedad.
 *
 * No es un detalle de performance, es el límite declarado de la medición:
 *
 *   - Si la cola entra entera en el sample (`depth <= PENDING_SAMPLE`), la
 *     antigüedad medida es EXACTA.
 *   - Si no entra, el sample es la CABEZA del ZSET, que está ordenado por
 *     (prioridad, contador) y no por tiempo: el más viejo puede quedar afuera y
 *     la antigüedad queda SUBESTIMADA. Nunca sobreestimada — o sea, el error
 *     posible es no avisar, jamás avisar de más.
 *
 * Se declara en el snapshot (`sampleTruncated`) para que el aviso lo diga en vez
 * de que alguien lo descubra leyendo este comentario dentro de dos años.
 */
export const PENDING_SAMPLE = 200;

export type EventBusSnapshot = {
  /** `null` cuando este proceso no corre el worker (worker_mode = server). */
  workerRunning: boolean | null;
  counts: { wait: number; prioritized: number; active: number; delayed: number };
  /** `wait` + `prioritized`: lo que espera a que alguien lo tome. */
  pendingDepth: number;
  /** Antigüedad del pendiente MÁS VIEJO del sample. `null` si no hay pendientes. */
  oldestPendingAgeMs: number | null;
  /** Tiempo que lleva EN PROCESO el activo más viejo del sample. `null` si no hay. */
  oldestActiveAgeMs: number | null;
  /** El nombre del evento más viejo, para que el aviso diga qué subscriber mirar. */
  oldestPendingName: string | null;
  oldestActiveName: string | null;
  sampleTruncated: boolean;
};

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/**
 * Antigüedad máxima del sample y el nombre del evento que la produce.
 *
 * `at` elige el reloj de cada población: para los pendientes es `timestamp` (cuándo
 * se ENCOLÓ), para los activos es `processedOn` (cuándo EMPEZÓ a procesarse). Usar
 * `timestamp` en los activos mezclaría el tiempo de espera con el de proceso y
 * haría saltar la alarma por una cola que se está recuperando bien.
 */
function oldestOf(
  jobs: Array<EventBusJobLike | null | undefined>,
  now: number,
  at: (job: EventBusJobLike) => number | null | undefined,
): { ageMs: number | null; name: string | null } {
  let ageMs: number | null = null;
  let name: string | null = null;
  for (const job of jobs) {
    if (!job) continue;
    const started = at(job);
    if (typeof started !== 'number' || !Number.isFinite(started)) continue;
    const age = now - started;
    if (ageMs === null || age > ageMs) {
      ageMs = age;
      name = job.name ?? null;
    }
  }
  return { ageMs, name };
}

/**
 * Lee la cola. Si algo falla, LANZA: el que llama tiene que reportar "no pude
 * medir", nunca "todo bien". Un verde que en realidad es un error tapado es peor
 * que no tener monitor — es la misma falla silenciosa que este archivo persigue.
 */
export async function readEventBusSnapshot(input: {
  queue: EventBusQueueLike;
  worker: EventBusWorkerLike | null;
  now?: number;
}): Promise<EventBusSnapshot> {
  const now = input.now ?? Date.now();
  const counts = await input.queue.getJobCounts('wait', 'prioritized', 'active', 'delayed');

  const wait = num(counts.wait ?? counts.waiting);
  const prioritized = num(counts.prioritized);
  const active = num(counts.active);
  const delayed = num(counts.delayed);

  const pending = await input.queue.getJobs(['waiting', 'prioritized'], 0, PENDING_SAMPLE - 1);
  const activeJobs = await input.queue.getJobs(['active'], 0, PENDING_SAMPLE - 1);

  const oldestPending = oldestOf(pending, now, (job) => job.timestamp);
  const oldestActive = oldestOf(activeJobs, now, (job) => job.processedOn ?? job.timestamp);

  return {
    workerRunning: input.worker ? input.worker.isRunning() : null,
    counts: { wait, prioritized, active, delayed },
    pendingDepth: wait + prioritized,
    oldestPendingAgeMs: oldestPending.ageMs,
    oldestActiveAgeMs: oldestActive.ageMs,
    oldestPendingName: oldestPending.name,
    oldestActiveName: oldestActive.name,
    sampleTruncated: wait + prioritized > PENDING_SAMPLE || active > PENDING_SAMPLE,
  };
}

export type EventBusFailureKind =
  /** Mecanismo B: el `run()` del worker terminó y nadie lo vuelve a arrancar. */
  | 'worker-not-running'
  /** Hay eventos esperando hace demasiado: nadie los está tomando. */
  | 'queue-stalled'
  /** Mecanismo A: alguien los tomó y no los suelta. */
  | 'subscriber-stuck';

export type EventBusVerdict =
  /**
   * NO APLICA. Sin Redis el event bus es el local en memoria: no hay cola que
   * mirar y no hay nada roto. Es distinto de `unknown` a propósito.
   */
  | { status: 'skipped'; reason: string }
  /**
   * NO SE PUDO MEDIR, y se esperaba poder. Se avisa igual: un monitor que se calla
   * cuando no ve es indistinguible de un monitor sano, que es exactamente el modo
   * de falla que estamos combatiendo.
   */
  | { status: 'unknown'; reason: string }
  | { status: 'ok'; detail: string }
  | { status: 'down'; kind: EventBusFailureKind; detail: string };

export type AssessOptions = {
  /** A partir de cuántos ms de espera se considera que nadie está consumiendo. */
  stallMs: number;
};

const minutes = (ms: number): string => `${Math.round((ms / 60_000) * 10) / 10} min`;

/**
 * ¿Hay que esperar un event bus sobre Redis en esta instalación?
 *
 * Calcado del gate de `medusa-config.ts:83` (`DISABLE_REDIS === 'true' ? undefined
 * : REDIS_URL`), a propósito: si esto y aquello divergen, el monitor opina sobre
 * una configuración que la app no tiene.
 */
export function redisEventBusExpected(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.DISABLE_REDIS === 'true') return false;
  return !!env.REDIS_URL?.trim();
}

/**
 * El orden de las reglas ES la respuesta, no un detalle de implementación.
 *
 * El worker va PRIMERO porque es evidencia directa y nombra la causa: con
 * `isRunning() === false` no hace falta inferir nada de la cola, y además dispara
 * ANTES de que se acumule un solo evento — el resto de las señales necesitan que
 * alguien emita algo para poder verlo. De madrugada, sin tráfico, la regla del
 * worker es la única que detecta el mecanismo B.
 */
export function assessEventBusHealth(
  snapshot: EventBusSnapshot,
  options: AssessOptions,
): EventBusVerdict {
  if (snapshot.workerRunning === false) {
    return {
      status: 'down',
      kind: 'worker-not-running',
      detail:
        `el Worker de BullMQ existe en este proceso pero \`isRunning()\` es false. ` +
        `Es el mecanismo B: \`run()\` terminó (o rechazó) y el event-bus-redis NO lo ` +
        `vuelve a arrancar nunca. Hay ${snapshot.pendingDepth} evento(s) esperando.`,
    };
  }

  if (snapshot.oldestPendingAgeMs !== null && snapshot.oldestPendingAgeMs >= options.stallMs) {
    return {
      status: 'down',
      kind: 'queue-stalled',
      detail:
        `el evento más viejo lleva ${minutes(snapshot.oldestPendingAgeMs)} esperando ` +
        `(umbral: ${minutes(options.stallMs)})` +
        (snapshot.oldestPendingName ? `, y es \`${snapshot.oldestPendingName}\`` : '') +
        `. Hay ${snapshot.pendingDepth} evento(s) en cola y nadie los está tomando.`,
    };
  }

  if (snapshot.oldestActiveAgeMs !== null && snapshot.oldestActiveAgeMs >= options.stallMs) {
    return {
      status: 'down',
      kind: 'subscriber-stuck',
      detail:
        `hay un evento ACTIVO desde hace ${minutes(snapshot.oldestActiveAgeMs)} ` +
        (snapshot.oldestActiveName ? `(\`${snapshot.oldestActiveName}\`) ` : '') +
        `sobre un umbral de ${minutes(options.stallMs)}. Es el mecanismo A: un ` +
        `subscriber que no resuelve ni rechaza, ocupando un slot de concurrencia.`,
    };
  }

  return {
    status: 'ok',
    detail:
      `pendientes=${snapshot.pendingDepth} activos=${snapshot.counts.active} ` +
      `demorados=${snapshot.counts.delayed} ` +
      `espera_max=${snapshot.oldestPendingAgeMs === null ? 'n/a' : minutes(snapshot.oldestPendingAgeMs)}`,
  };
}

/**
 * Throttle de avisos, calcado de `warnTemplateOutOfScope` en
 * `modules/email/service.ts`: un `Map` en memoria con TTL, sin estado en base.
 *
 * El motivo es el mismo de allá y vale repetirlo: una señal que se repite cada
 * ciclo deja de ser una señal y se vuelve un muro que tapa el log — o, peor acá,
 * 288 mails por día. Con el TTL, la primera detección avisa YA y las siguientes
 * esperan.
 *
 * Que muera con el proceso es CORRECTO y no una limitación: un restart reinicia el
 * worker del bus, así que el estado anterior dejó de valer y volver a avisar es la
 * conducta buscada.
 *
 * La clave es el TIPO de falla y no un valor fijo: si el bus pasa de
 * `subscriber-stuck` a `worker-not-running`, la segunda es información nueva y no
 * puede quedar tapada por la ventana de la primera.
 */
export class AlertThrottle {
  private readonly last = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  shouldEmit(key: string, now: number = Date.now()): boolean {
    const previous = this.last.get(key);
    if (previous !== undefined && now - previous < this.ttlMs) return false;
    this.last.set(key, now);
    return true;
  }

  /** Devuelve `true` si había algo silenciado: el que llama lo usa para loguear la
   *  recuperación SÓLO cuando hubo una caída de verdad, y no en cada ciclo sano. */
  reset(): boolean {
    if (this.last.size === 0) return false;
    this.last.clear();
    return true;
  }
}

/**
 * Lo que el período de gracia necesita saber del supervisor, escrito de forma
 * ESTRUCTURAL para no acoplar esta librería a
 * `lib/event-bus-worker-supervisor.ts`: el snapshot real encaja tal cual.
 */
export type SupervisorPulse = {
  state: string;
  restarts: number;
  consecutiveFailures: number;
  nextRetryAt: number | null;
};

export type MailGraceInput = {
  /** El `kind` del veredicto caído. La gracia es POR TIPO de falla, igual que el throttle. */
  kind: string;
  /** El snapshot del supervisor del worker, o `null` si no hay supervisor en este proceso. */
  supervisor: SupervisorPulse | null;
  /** `process.uptime() * 1000`. Se pasa como dato para poder testearlo. */
  uptimeMs: number;
  /** Cuánto dura la gracia por arranque reciente. */
  bootGraceMs: number;
};

export type MailGraceVerdict = {
  /** `true` = el MAIL espera al tick siguiente. El log sale igual. */
  defer: boolean;
  /** Por qué, en palabras del que lo lee en el log. */
  reason: string;
};

/**
 * EL PERÍODO DE GRACIA DEL MAIL.
 *
 * ── POR QUÉ EXISTE, con el log en la mano ───────────────────────────────────
 *
 * Boilerplate, 2026-09-18. El backend arrancó 12:20:06 y tardó 462 segundos en
 * quedar listo (el Valkey rechazando conexiones durante el deploy):
 *
 *   12:28:03  Server is ready on port 9000
 *   12:28:03  [event-bus-supervisor] murió tras 339 ms → se construye uno nuevo en 1000 ms
 *   12:28:03  [event-bus-monitor] EL EVENT BUS NO ESTÁ CONSUMIENDO → 📧 mail
 *   12:28:04  [event-bus-supervisor] RECUPERADO tras 1 falla y 1 reconstrucción
 *   12:30:04  [event-bus-monitor] RECUPERADO: el bus vuelve a consumir
 *
 * El supervisor (PR #1122) hizo exactamente su trabajo: se curó en UN SEGUNDO. Lo
 * que falló es el aviso: el primer tick del monitor cayó dentro de ese segundo y
 * mandó el mail igual. Un mail de alerta por un parpadeo que se auto-cura es cómo
 * una alerta deja de leerse — y esta alerta existe porque una vez nadie se enteró
 * durante tres días.
 *
 * ── LA REGLA, Y POR QUÉ NO TAPA LA CAÍDA DE VERDAD ──────────────────────────
 *
 * Se posterga COMO MÁXIMO UN TICK, y una sola vez por `kind` hasta la próxima
 * recuperación. Si en el tick siguiente el bus sigue caído, el mail sale. Las
 * caídas reales (2026-08-31, 09-03, 09-09) duraron HORAS: pierden 5 minutos, no el
 * aviso. El blip de un segundo, en cambio, ya se curó para el tick siguiente y el
 * mail no sale nunca.
 *
 * Se posterga cuando pasa alguna de estas dos, que son las dos formas de "esto se
 * está curando solo ahora mismo":
 *
 *   1. El supervisor está VIVO y a cargo: `waiting` (esperando el backoff para
 *      reconstruir) o `running` con al menos una falla contada (acaba de
 *      reconstruir y está conectando). Sin supervisor —una instalación que apunte
 *      `event_bus` al paquete de Medusa pelado— NO hay nadie curando nada y el
 *      aviso sale en el primer tick, como siempre.
 *   2. El proceso arrancó hace poco. El boot de arriba tardó 462 s, así que el
 *      primer tick del cron cae con el bus todavía acomodándose. La gracia por
 *      arranque cubre ese caso aunque el supervisor ya figure sano.
 *
 * Lo que NO se demora es la DETECCIÓN: el `logger.error` con el reporte completo
 * sale igual en el tick que posterga. Lo único que espera es el correo.
 */
export class MailGrace {
  private readonly deferred = new Set<string>();

  consider(input: MailGraceInput): MailGraceVerdict {
    if (this.deferred.has(input.kind)) {
      return {
        defer: false,
        reason:
          'ya se había postergado un tick y el bus SIGUE caído: esto no es un parpadeo, ' +
          'el aviso sale ahora.',
      };
    }

    const supervisor = input.supervisor;
    const rebuilding =
      supervisor !== null &&
      (supervisor.state === 'waiting' ||
        (supervisor.state === 'running' && supervisor.consecutiveFailures > 0));
    const booting = input.uptimeMs < input.bootGraceMs;

    if (!rebuilding && !booting) {
      return {
        defer: false,
        reason: supervisor
          ? 'el supervisor no está reconstruyendo nada y el proceso no acaba de arrancar: ' +
            'no hay nadie curándolo, el aviso sale ya.'
          : 'no hay supervisor del worker en este proceso: nadie va a reconstruirlo solo, ' +
            'el aviso sale ya.',
      };
    }

    this.deferred.add(input.kind);
    const because = rebuilding
      ? `el supervisor del worker está en \`${supervisor!.state}\` con ` +
        `${supervisor!.consecutiveFailures} falla(s) y ${supervisor!.restarts} ` +
        'reconstrucción(es): se está curando solo'
      : `el proceso arrancó hace ${Math.round(input.uptimeMs / 1000)} s ` +
        `(gracia de arranque: ${Math.round(input.bootGraceMs / 1000)} s)`;

    return {
      defer: true,
      reason: `${because}. El mail espera UN tick; si el bus sigue caído, sale.`,
    };
  }

  /** `true` si había un aviso postergado. El que llama lo usa para no perder la
   *  línea de RECUPERADO cuando el único rastro de la caída fue una postergación. */
  reset(): boolean {
    if (this.deferred.size === 0) return false;
    this.deferred.clear();
    return true;
  }
}

/** Texto del aviso. Separado del job para poder testearlo y para que el mail y el
 *  log digan EXACTAMENTE lo mismo. */
export function formatDownReport(
  verdict: Extract<EventBusVerdict, { status: 'down' }>,
  snapshot: EventBusSnapshot,
): string {
  const lines = [
    `EL EVENT BUS NO ESTÁ CONSUMIENDO (${verdict.kind}): ${verdict.detail}`,
    '',
    `Cola: wait=${snapshot.counts.wait} prioritized=${snapshot.counts.prioritized} ` +
      `active=${snapshot.counts.active} delayed=${snapshot.counts.delayed}`,
    `Worker en este proceso: ${
      snapshot.workerRunning === null ? 'no corre acá (worker_mode=server)' : snapshot.workerRunning
    }`,
    '',
    'Mientras esto siga así NO salen los mails de orden, NO sale el WhatsApp y NO se',
    'drena el outbox del ERP. Los crons y el HTTP siguen sanos: no esperes que se caiga.',
    '',
    'Qué mirar, en orden:',
    '  1. `Error running event bus worker` en el log del backend — es la ÚNICA línea que',
    '     deja el mecanismo B (event-bus-redis/dist/services/event-bus-redis.js:21).',
    '  2. La conexión a Redis/Valkey (ETIMEDOUT, connection reset, límite de conexiones).',
    '  3. Si el kind es `subscriber-stuck`: qué subscriber está atendiendo el evento que',
    '     figura arriba, y si hace una llamada externa sin timeout.',
    '',
    'Se destraba reiniciando el backend. Eso NO es el arreglo: es el paliativo.',
  ];
  if (snapshot.sampleTruncated) {
    lines.push(
      '',
      `NOTA: la cola supera las ${PENDING_SAMPLE} entradas del sample, así que la ` +
        'antigüedad informada es un PISO, no el máximo real.',
    );
  }
  return lines.join('\n');
}
