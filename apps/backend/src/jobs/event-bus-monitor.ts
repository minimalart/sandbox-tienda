import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  AlertThrottle,
  MailGrace,
  assessEventBusHealth,
  formatDownReport,
  readEventBusSnapshot,
  redisEventBusExpected,
  type EventBusQueueLike,
  type EventBusVerdict,
  type EventBusRedisClientLike,
  type EventBusWorkerLike,
} from '../lib/event-bus-health';
import {
  describeSupervisor,
  getLiveEventBusWorkerSupervisor,
  requestSupervisorRestart,
  type EventBusWorkerSupervisorLike,
} from '../lib/event-bus-worker-supervisor';
import { loadLazyModule, sourceSpecifier } from '../lib/lazy-module';

/**
 * El único vigilante del event bus que sobrevive a que el event bus se muera.
 *
 * El porqué de todo esto —los tres días mudos, los dos mecanismos posibles, y por
 * qué la señal es la ANTIGÜEDAD y no la profundidad— está escrito en
 * `lib/event-bus-health.ts`. Este archivo es sólo el cableado: de dónde sale la
 * cola, cómo se avisa, y cada cuánto.
 *
 * ── DE DÓNDE SALE LA COLA, Y POR QUÉ NO SE AGREGÓ NINGUNA DEPENDENCIA ────────
 *
 * `bullmq` e `ioredis` NO son dependencias directas de `apps/backend` (están sólo
 * como transitivas de `@medusajs/event-bus-redis`). Había tres caminos y se eligió
 * el tercero:
 *
 *   1. Agregar `bullmq`/`ioredis` al `package.json`. Cuesta un movimiento del
 *      lockfile en un monorepo cuyo lockfile es frágil —y cuyo `pnpm install`
 *      además necesita un PAT para los paquetes `@minimalart`—, todo para
 *      reconstruir un objeto que ya existe en memoria.
 *   2. Importar `bullmq` por resolución transitiva. No mueve el lockfile pero es
 *      frágil de otra manera: rompe el día que pnpm cambie el hoisting o que
 *      Medusa mueva su dependencia, y rompe en RUNTIME, en el monitor, o sea en
 *      el único lugar donde un error se confunde con "todo bien".
 *   3. **Usar el objeto `Queue` que el módulo de event bus YA tiene abierto.** Es
 *      lo que se hizo. Cero dependencias nuevas, cero líneas de lockfile, y —lo
 *      que más importa— cero conexiones nuevas contra el Valkey administrado de
 *      DO, que tiene tope de conexiones por plan (ver la nota de `redisOptions` en
 *      `medusa-config.ts`, donde ese tope ya causó un boot de minutos).
 *
 * Y hay un cuarto beneficio que no es menor: los nombres. La cola no es
 * `bull:events-queue:*` como sugeriría el default de BullMQ — el servicio la crea
 * con `prefix: ${this.constructor.name}`, o sea `RedisEventBusService:events-queue:*`
 * (`event-bus-redis.js:120-131`). Leyendo claves de Redis a mano habría que
 * hardcodear ese prefijo y el día que Medusa renombre la clase el monitor
 * mediría una cola vacía y daría VERDE. Pidiéndole el objeto al módulo, los
 * nombres vienen puestos.
 *
 * El costo de la opción 3 está a la vista y se declara: `queue_` y `bullWorker_`
 * son campos internos de un paquete de terceros. Por eso NO se asume que existan:
 * si no están, esto reporta `unknown` —"no pude medir"— y avisa. Nunca `ok`.
 *
 * ── EL CANAL DE AVISO NO PUEDE SER EL BUS ────────────────────────────────────
 *
 * Un `emit` de alerta se encolaría al lado de las órdenes que nadie consume. Los
 * dos canales de acá son directos: `logger.error` (el piso, siempre) y el módulo
 * de notificación llamado a mano, que es exactamente lo que hace `cart-abandoned`
 * —y `cart-abandoned` siguió saliendo los tres días de la caída, o sea que ese
 * camino está comprobado contra ESTA falla.
 */

/** Lo que este job necesita del servicio de event bus, sin depender de sus tipos. */
type RedisEventBusInternals = {
  queue_?: EventBusQueueLike;
  bullWorker_?: EventBusWorkerLike;
  /**
   * Lo expone el módulo envuelto (`modules/event-bus-redis`), que es el dueño del
   * ciclo de vida del worker. Ausente en una instalación que siga apuntando
   * `event_bus` al paquete de Medusa pelado.
   */
  workerSupervisor?: EventBusWorkerSupervisorLike | null;
};

const minutesToMs = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * 60_000 : fallback * 60_000;
};

/**
 * Ventana del throttle. 30 minutos: suficiente para que una caída de tres días deje
 * ~144 marcas en el log (imposible de no ver) sin convertir el log en un muro.
 */
const alertThrottle = new AlertThrottle(
  minutesToMs(process.env.EVENT_BUS_MONITOR_ALERT_TTL_MINUTES, 30),
);

/**
 * El período de gracia del MAIL (el log no se demora nunca). El porqué y la regla
 * están en `MailGrace`, en `lib/event-bus-health.ts`.
 */
const mailGrace = new MailGrace();

/**
 * Gracia por arranque reciente. 10 minutos porque está MEDIDO: el boot del
 * 2026-09-18 tardó 462 segundos en llegar a `Server is ready`, y el primer tick del
 * cron cayó justo ahí. Menos que eso no cubriría el caso que motivó la gracia.
 */
const bootGraceMs = (): number =>
  minutesToMs(process.env.EVENT_BUS_MONITOR_BOOT_GRACE_MINUTES, 10);

/**
 * El "no aplica" se dice UNA vez por proceso y no cada cinco minutos.
 *
 * No es una alerta: es la configuración de la instalación. Pero tampoco puede ser
 * silencio, porque entonces "el monitor no dice nada" significaría dos cosas
 * distintas —sano y apagado— y volveríamos al problema original.
 */
let skipAnnounced = false;

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/**
 * Resuelve la cola y el worker del event bus, o dice por qué no pudo.
 *
 * Devuelve un veredicto ya formado en los caminos de "no hay nada que medir"
 * porque la DISTINCIÓN entre `skipped` y `unknown` es el corazón del requisito: sin
 * Redis, el bus es el local en memoria y este monitor no aplica (`skipped`); con
 * Redis configurado pero sin poder leer la cola, algo cambió abajo y hay que
 * gritarlo (`unknown`).
 */
function resolveQueue(
  container: MedusaContainer,
):
  | {
      ok: true;
      queue: EventBusQueueLike;
      worker: EventBusWorkerLike | null;
      supervisor: EventBusWorkerSupervisorLike | null;
    }
  | { ok: false; verdict: EventBusVerdict } {
  if (!redisEventBusExpected()) {
    return {
      ok: false,
      verdict: {
        status: 'skipped',
        reason:
          'no hay Redis configurado (DISABLE_REDIS=true o REDIS_URL vacío), así que el ' +
          'event bus es el local en memoria: no hay cola BullMQ que vigilar.',
      },
    };
  }

  let service: RedisEventBusInternals | undefined;
  try {
    service = container.resolve(Modules.EVENT_BUS, {
      allowUnregistered: true,
    }) as RedisEventBusInternals | undefined;
  } catch {
    service = undefined;
  }

  if (!service) {
    return {
      ok: false,
      verdict: {
        status: 'unknown',
        reason: `hay REDIS_URL configurada pero el contenedor no resuelve "${Modules.EVENT_BUS}".`,
      },
    };
  }

  const queue = service.queue_;
  if (!queue || typeof queue.getJobCounts !== 'function' || typeof queue.getJobs !== 'function') {
    return {
      ok: false,
      verdict: {
        status: 'unknown',
        reason:
          'hay REDIS_URL configurada pero el servicio de event bus no expone una cola ' +
          'BullMQ en `queue_`. O la instalación quedó con el bus local, o cambió el ' +
          'interior de @medusajs/event-bus-redis y este monitor dejó de ver la cola. ' +
          'Mientras tanto NO está midiendo nada.',
      },
    };
  }

  const bullWorker = service.bullWorker_;
  // Sin worker en este proceso (worker_mode = server) la señal directa del
  // mecanismo B no existe, pero la cola SÍ se puede medir. No es motivo para
  // saltear: `null` propaga "no sé" a esa única regla y las de antigüedad siguen.
  const worker =
    bullWorker && typeof bullWorker.isRunning === 'function' ? bullWorker : null;

  /**
   * El servicio PRIMERO, el registro del proceso como red.
   *
   * Leerlo sólo del servicio resuelto venía dando `null` en producción con el
   * supervisor corriendo en el mismo proceso: el 2026-09-17 el monitor mandó el
   * mail diciendo "módulo de Medusa sin envolver" un segundo después de que el
   * supervisor reconstruyera el worker y justo antes de que lo diera por
   * RECUPERADO. `queue_` y `bullWorker_` sí se leen porque son propiedades que
   * setea el constructor de la clase core; `workerSupervisor` es un getter del
   * prototipo de la subclase y no sobrevive el camino hasta acá.
   *
   * El fallback no tapa nada: si el módulo envuelto no está instalado, nadie
   * publicó nada y sigue dando `null`, que es el diagnóstico correcto.
   */
  const fromService =
    service.workerSupervisor && typeof service.workerSupervisor.restartNow === 'function'
      ? service.workerSupervisor
      : null;
  const supervisor = fromService ?? getLiveEventBusWorkerSupervisor();

  return { ok: true, queue, worker, supervisor };
}

type AdminRecipientModule = {
  getAdminNotificationEmail: (container: MedusaContainer) => Promise<string | null>;
};

/**
 * El helper del destinatario.
 *
 * Acá vivió un doble intento propio —`'…admin-recipient.js'` y después el mismo
 * especificador sin extensión— que SEGUÍA FALLANDO en producción con el fix
 * instalado. Log del boilerplate del 2026-09-18 12:28:03, en plena caída:
 *
 *   [event-bus-monitor] no se pudo resolver el destinatario por el módulo de email
 *   (Cannot find module '…/modules/email/admin-recipient.js' …). Se sigue con la env.
 *
 * Las dos ramas eran `import()`, o sea el mismo mecanismo ESM, y el resolver ESM de
 * Node no inventa extensiones: en producción el archivo en disco es `.ts`. La forma
 * que SÍ resuelve —`require()` sin extensión, que es lo que la propia Medusa usa—
 * y la medición que lo demuestra están en `lib/lazy-module.ts`.
 *
 * Sigue siendo diferido: `modules/email/` lo posee la extensión `email-templates` y
 * este job es infraestructura de base (ver la nota de `resolveRecipient`).
 */
async function importAdminRecipient(): Promise<AdminRecipientModule> {
  return loadLazyModule<AdminRecipientModule>(
    'el destinatario de aviso del módulo de email',
    () => require('../modules/email/admin-recipient'),
    () => import(sourceSpecifier('../modules/email/admin-recipient')),
  );
}

/**
 * El destinatario del aviso, SIN importar estáticamente el módulo de email.
 *
 * `modules/email/` lo posee la extensión `email-templates` (ver
 * `packages/project-composer/src/component-definitions.js`), y este job es
 * infraestructura de base. Un `import` estático tendría DOS consecuencias, las dos
 * malas y ninguna obvia:
 *
 *   1. `resolve-ownership.js` le da un archivo de `src/jobs/` a la extensión cuyo
 *      módulo importa. O sea que el monitor del event bus pasaría a ser parte de
 *      "Plantillas de email", y una instalación que no elija esa extensión se
 *      quedaría sin monitor del bus. (Verificado: con el import estático,
 *      `site:components:verify` reporta `[ownership] email-templates: extract owns
 *      apps/backend/src/jobs/event-bus-monitor.ts`.)
 *   2. En un proyecto compuesto SIN `email-templates` el archivo directamente no
 *      existe, y un import estático a una ruta ausente rompe el arranque del
 *      backend entero por un canal de aviso opcional.
 *
 * El `import()` perezoso invierte la dependencia: si el módulo está, se usa el
 * mejor destinatario (`admin_notification_email` → `ADMIN_EMAIL`); si no está, se
 * cae a `ADMIN_EMAIL` a secas. El `logger.error` no depende de nada de esto y sale
 * igual: es el piso del aviso, no el mail.
 */
async function resolveRecipient(
  container: MedusaContainer,
  logger: Logger,
): Promise<string | null> {
  try {
    /**
     * Si la resolución falla no rompe nada: cae en el `catch` y el aviso sale igual
     * por `ADMIN_EMAIL` — el `logger.error` ni se entera. Lo que SÍ importa es que
     * el motivo quede escrito, y por eso `loadLazyModule` nombra cada forma probada.
     */
    const { getAdminNotificationEmail } = await importAdminRecipient();
    const to = await getAdminNotificationEmail(container);
    if (to) return to;
    logger.warn(
      '[event-bus-monitor] el módulo de email resolvió SIN destinatario: ni la fila de ' +
        '`email_branding` (la global, o la de la única tienda) ni el `ADMIN_EMAIL` de ' +
        '`app-settings` tienen `admin_notification_email`. Se sigue con la env.',
    );
  } catch (error) {
    /**
     * ESTE `catch` ESTABA VACÍO, Y ES POR QUÉ EL MONITOR SE QUEDÓ MUDO.
     *
     * El 2026-09-09 el event bus de desdeelsur estuvo caído ~50 minutos. El monitor
     * lo detectó en cada tick de 5 minutos y dejó `no hay destinatario de aviso
     * configurado` — pero `getAdminNotificationEmail(container)` SIN hint resuelve
     * `singleSite`, y esa instalación es mono-tienda con `info@desdelsur.com.ar` en la
     * fila de su tienda. O sea que había destinatario y algo falló acá adentro: el
     * `import()` dinámico, `resolveSite`, o `getEmailBranding`. No se puede saber cuál,
     * porque esto no dejaba rastro.
     *
     * Un `catch` que devuelve lo mismo que el camino de al lado no maneja el error: lo
     * entierra. Nos enteramos del bus caído por una compra de prueba, no por el
     * vigilante que existe para avisarlo.
     */
    logger.warn(
      '[event-bus-monitor] no se pudo resolver el destinatario por el módulo de email ' +
        `(${error instanceof Error ? error.message : String(error)}). Se sigue con la env.`,
    );
  }
  return process.env.ADMIN_EMAIL?.trim() || null;
}

/**
 * El mail al admin. `template: '__inline__'` es la puerta reservada del provider
 * (`modules/email/service.ts:433`) que manda asunto y HTML ya renderizados: evita
 * inventar una plantilla nueva, una fila en `email_template` y una entrada en el
 * catálogo de variables para un mail que nadie va a querer editar.
 *
 * Sin pista de tienda a propósito: esto NO es de una tienda. Un event bus muerto lo
 * está para las N tiendas de la instalación, así que el destinatario correcto es el
 * global (`admin_notification_email` global → `ADMIN_EMAIL`). Mandar una pista
 * elegiría arbitrariamente el buzón de una y dejaría a las demás sin enterarse.
 */
async function mailAdmin(
  container: MedusaContainer,
  logger: Logger,
  subject: string,
  report: string,
): Promise<void> {
  if (process.env.EVENT_BUS_MONITOR_EMAIL === 'false') return;

  const to = await resolveRecipient(container, logger);
  if (!to) {
    logger.warn(
      '[event-bus-monitor] no hay destinatario de aviso configurado ' +
        '(`admin_notification_email` ni `ADMIN_EMAIL`): el aviso queda sólo en el log. ' +
        'Se arregla seteando `ADMIN_EMAIL` en el entorno del backend — es la mejora más ' +
        'barata que existe acá: convierte "nos enteramos por una compra" en "nos ' +
        'enteramos en 5 minutos". Los warnings de arriba dicen por qué no se resolvió.',
    );
    return;
  }

  try {
    // El overload de `createNotifications` está tipado contra `CreateNotificationDTO`,
    // que no admite `template: '__inline__'` como literal libre: se estrecha vía
    // `unknown` en vez de rearmar el DTO entero para un mail de alerta.
    const notification = container.resolve(Modules.NOTIFICATION) as unknown as {
      createNotifications(input: Record<string, unknown>): Promise<unknown>;
    };
    await notification.createNotifications({
      to,
      channel: 'email',
      template: '__inline__',
      data: {
        __subject: subject,
        __html: `<pre style="font:13px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(report)}</pre>`,
      },
    });
  } catch (error) {
    // Que el mail falle no puede tapar la alerta: el `logger.error` ya salió.
    logger.warn(
      `[event-bus-monitor] el aviso por mail a ${to} falló: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Volver a arrancar el worker que Medusa dejó tirado.
 *
 * POR QUÉ EXISTE, con el log de producción en la mano. El 2026-09-03 a las 20:47:33
 * el backend dejó esta línea y nada más:
 *
 *   Error running event bus worker: Connection is closed.
 *     at EventEmitter.connectionCloseHandler (ioredis/built/Redis.js:220)
 *
 * BullMQ consume con un comando BLOQUEANTE. Valkey cortó la conexión —idle timeout,
 * failover, mantenimiento, tope de conexiones—, el comando bloqueante rechazó, y
 * `run()` se cayó con él. `event-bus-redis.js:21` lo envuelve en
 * `void ....catch(err => logger.error(...))`: LOGUEA Y NO LO VUELVE A ARRANCAR NUNCA.
 *
 * O sea que un parpadeo de red de un segundo deja el bus muerto para siempre. Y no se
 * nota: el proceso sigue sano, los crons corren, el HTTP responde. La primera vez
 * fueron TRES DÍAS y 5343 eventos encolados, y se descubrió por un reporte en Slack.
 *
 * `maxRetriesPerRequest: null` ya está puesto y no alcanza: hace que ioredis reintente
 * los comandos, no que BullMQ vuelva a entrar al loop de consumo que ya abandonó.
 *
 * NO SE AWAITEA, y no es un descuido. `run()` sólo resuelve cuando el worker se
 * cierra: esperarlo colgaría este job para siempre — que es, con ironía, el mismo modo
 * de falla que el monitor vino a detectar. Se dispara y el veredicto del tick
 * siguiente dice si prendió; si no prendió, se reintenta a los 5 minutos. El ritmo lo
 * pone el cron y por eso no hace falta backoff propio.
 *
 * SIGUE SIENDO UN PALIATIVO AUTOMÁTICO, no la cura. La cura es que el provider
 * rearme solo, y eso es de Medusa. Mientras tanto esto convierte "tres días muertos"
 * en "cinco minutos", sin que nadie tenga que estar mirando.
 */
/**
 * Techo de tiempo para todo lo que le pedimos a la conexión.
 *
 * 5 segundos: la conexión está sana o está rechazada, no hay término medio que
 * justifique esperar más dentro de un job que corre cada 5 minutos.
 */
const CONNECTION_DEADLINE_MS = 5_000;

/**
 * Mensajes que dicen "el otro lado no me deja conectar", no "el código está mal".
 *
 * La distinción no es cosmética: decide a quién le sirve el log. Un
 * `Connection is closed.` en el re-arme significa que reintentar es inútil hasta que
 * alguien mire la infra, y decirlo ahorra el paseo entero por el código.
 */
const CONNECTION_LEVEL_ERROR =
  /connection is closed|econnrefused|etimedout|econnreset|enotfound|max number of clients|ready check failed/i;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Espera una promesa AJENA con techo de tiempo.
 *
 * Existe por `worker.client`: BullMQ lo deja pendiente para siempre si la conexión
 * nunca se establece, y awaitearlo sin techo colgaría este job — la misma falla que
 * el monitor vino a detectar.
 */
async function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} no respondió en ${CONNECTION_DEADLINE_MS} ms`)),
          CONNECTION_DEADLINE_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reabre la conexión del worker si quedó cerrada, y devuelve en una frase qué pasó.
 *
 * ── POR QUÉ REVIVIR Y NO CONSTRUIR ───────────────────────────────────────────
 *
 * `run()` a secas no alcanza y está MEDIDO: el 2026-09-09, con el bus caído, el
 * re-arme falló con `Connection is closed.` en cada tick. BullMQ consume con un
 * comando bloqueante; cuando su conexión muere, `run()` intenta reestablecerla y
 * rechaza con lo mismo, para siempre. Reintentar sobre la conexión muerta es
 * pedirle a un teléfono desconectado que vuelva a marcar.
 *
 * La tentación es construir un Worker nuevo: se puede, sin agregar `bullmq` como
 * dependencia, porque `event-bus-redis.js:127` lo crea con
 * `new Worker(this.queueName_, this.worker_, ...)` y las dos cosas son propiedades
 * del service. NO SE HACE, y el motivo es la causa raíz observada: un Worker nuevo
 * necesita una CONEXIÓN nueva, y el `Connection is closed.` de desdeelsur sale del
 * handshake — o sea que el Valkey está rechazando conexiones, con el tope de
 * conexiones del plan como principal sospechoso (ver la nota de `redisOptions` en
 * `medusa-config.ts`, donde ese tope ya causó un boot de minutos). Un monitor que
 * abre clientes nuevos cada cinco minutos contra un Valkey al límite convierte una
 * caída de una hora en una permanente: sería el vigilante empujando en la dirección
 * del incendio.
 *
 * `connect()` de ioredis, en cambio, reabre el MISMO socket cuando quedó en `end`.
 * Cero clientes nuevos. Cubre el caso "el objeto quedó envenenado y el servidor
 * está sano", que es el que el código sí puede curar — y para el otro caso deja
 * dicho, en el log, que no lo puede curar nadie desde acá.
 */
async function reviveConnection(worker: EventBusWorkerLike, logger: Logger): Promise<string> {
  const blocking = worker.blockingConnection;

  // El camino bueno: `reconnect()` de BullMQ sobre la conexión BLOQUEANTE, que es
  // la que se muere. Ver la nota del tipo en `lib/event-bus-health.ts`.
  if (blocking && typeof blocking.reconnect === 'function') {
    try {
      await withDeadline(
        Promise.resolve(blocking.reconnect()),
        'el reconnect() de la conexión bloqueante',
      );
      logger.error('[event-bus-monitor] reconnect() de la conexión bloqueante OK.');
      return 'bloqueante, reconnect() de BullMQ OK';
    } catch (error) {
      return `bloqueante, reconnect() falló (${messageOf(error)})`;
    }
  }

  // Sin `reconnect()` se mira el estado, prefiriendo SIEMPRE la bloqueante. Y se
  // dice CUÁL se miró: un `ready` de la conexión equivocada es peor que no medir.
  const source = blocking?.client
    ? { label: 'bloqueante', promise: blocking.client }
    : worker.client
      ? { label: 'la del worker (NO la bloqueante)', promise: worker.client }
      : null;
  if (!source) return 'no la expone el worker';

  let client: EventBusRedisClientLike;
  try {
    client = await withDeadline(Promise.resolve(source.promise), `el cliente ${source.label}`);
  } catch (error) {
    // Que el `client` no resuelva ES el síntoma: la conexión no logra establecerse.
    return `${source.label}, ilegible (${messageOf(error)})`;
  }

  const status = client.status ?? 'desconocido';
  // `connect()` sobre una conexión viva o en curso RECHAZA ("Redis is already
  // connecting/connected"), así que estos estados se dejan en paz.
  if (['ready', 'connect', 'connecting', 'reconnecting'].includes(status)) {
    return `${source.label} en \`${status}\`, no hace falta tocarla`;
  }
  if (typeof client.connect !== 'function') {
    return `${source.label} en \`${status}\`, sin \`connect()\``;
  }

  try {
    await withDeadline(Promise.resolve(client.connect()), 'la reconexión');
    logger.error(
      `[event-bus-monitor] Conexión ${source.label} reabierta desde \`${status}\`.`,
    );
    return `${source.label} estaba en \`${status}\` y se reabrió`;
  } catch (error) {
    return `${source.label} estaba en \`${status}\` y reabrirla falló (${messageOf(error)})`;
  }
}

async function tryRearmWorker(
  worker: EventBusWorkerLike | null,
  logger: Logger,
): Promise<'disabled' | 'unsupported' | 'attempted'> {
  if (process.env.EVENT_BUS_MONITOR_REARM === 'false') return 'disabled';
  // Sin `run()` no hay nada que intentar: el monitor sigue avisando igual.
  if (!worker || typeof worker.run !== 'function') return 'unsupported';

  // El guard que evita el "Worker is already running" de BullMQ. `isRunning()` pasa a
  // true adentro de `run()`, así que en el tick siguiente esta condición ya no entra.
  if (worker.isRunning()) return 'unsupported';

  // ANTES de `run()`, y no después: `run()` sobre una conexión cerrada rechaza con
  // `Connection is closed.` sin intentar nada. Esto sí está acotado en tiempo.
  const connection = await reviveConnection(worker, logger);

  logger.error(
    '[event-bus-monitor] Reintentando arrancar el worker del event bus. ' +
      `Conexión: ${connection}. ` +
      'Si prende, el tick siguiente lo va a reportar como RECUPERADO.',
  );

  void Promise.resolve()
    .then(() => worker.run!())
    .catch((error: unknown) => {
      const message = messageOf(error);
      if (CONNECTION_LEVEL_ERROR.test(message)) {
        logger.error(
          `[event-bus-monitor] El reintento falló CONTRA LA CONEXIÓN: ${message}\n\n` +
            'Esto NO se arregla desde el código y reiniciar el backend TAMPOCO va a ' +
            'alcanzar: el Redis/Valkey no está aceptando la conexión. Mirar, en orden:\n' +
            '  1. conexiones activas del Valkey contra el tope del plan (un deploy que ' +
            'deja dos instancias vivas duplica las conexiones);\n' +
            '  2. mantenimiento, failover o resize del Valkey en la ventana de la caída;\n' +
            '  3. si el plan está al límite, subirlo.\n' +
            'Mientras la conexión sea rechazada, la cola sigue creciendo y NO salen los ' +
            'mails de orden, ni el WhatsApp, ni se drena el outbox del ERP.',
        );
        return;
      }
      logger.error(
        `[event-bus-monitor] El reintento de arranque falló: ${message}. ` +
          'Se vuelve a intentar en el próximo tick.',
      );
    });

  return 'attempted';
}

/**
 * Desde el módulo envuelto (`modules/event-bus-redis`), el ciclo de vida del worker
 * tiene UN dueño: su supervisor, que ya está esperando su backoff para
 * reconstruirlo. Acá sólo se le pide que corte esa espera. Lo que NO se hace es
 * llamar a `run()` por cuenta propia: sobre un Worker cuya conexión bloqueante
 * quedó envenenada rechaza para siempre, que es exactamente lo que el re-arme
 * directo hizo en cada tick del 2026-09-09 — y además dos dueños del mismo worker
 * se pisan (`Worker is already running`). Devuelve `true` si el supervisor se hizo
 * cargo; `false` deja caer al `run()` directo, que sigue siendo el camino para una
 * instalación que apunte `event_bus` al paquete de Medusa pelado.
 */
function delegateRearm(supervisor: EventBusWorkerSupervisorLike | null, logger: Logger): boolean {
  const request = requestSupervisorRestart(supervisor);
  logger.error(`[event-bus-monitor] Re-arme: ${request.line}`);
  return request.handled;
}

export default async function eventBusMonitorJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const stallMs = minutesToMs(process.env.EVENT_BUS_MONITOR_STALL_MINUTES, 10);

  const resolved = resolveQueue(container);

  let verdict: EventBusVerdict;
  let report: string | null = null;

  if (!resolved.ok) {
    verdict = resolved.verdict;
  } else {
    try {
      const snapshot = await readEventBusSnapshot({
        queue: resolved.queue,
        worker: resolved.worker,
      });
      verdict = assessEventBusHealth(snapshot, { stallMs });
      if (verdict.status === 'down') report = formatDownReport(verdict, snapshot);
    } catch (error) {
      // Leer la cola falló. NO se degrada a `ok` — ver la nota de `readEventBusSnapshot`.
      verdict = {
        status: 'unknown',
        reason: `falló la lectura de la cola: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  if (verdict.status === 'skipped') {
    if (!skipAnnounced) {
      skipAnnounced = true;
      logger.info(`[event-bus-monitor] no aplica en esta instalación: ${verdict.reason}`);
    }
    return;
  }

  if (verdict.status === 'ok') {
    // Sólo se habla cuando hubo caída. En régimen normal el monitor es mudo: si
    // dijera "todo bien" cada cinco minutos, nadie leería el log donde va a estar
    // la línea que importa.
    //
    // Los DOS reset importan: cuando el único rastro de la caída fue un mail
    // postergado —el blip que se cura en un segundo— el throttle nunca se tocó, y
    // sin mirar la gracia perderíamos la línea de RECUPERADO justo en el caso que
    // esta gracia vino a manejar.
    const hadAlert = alertThrottle.reset();
    const hadDeferred = mailGrace.reset();
    if (hadAlert || hadDeferred) {
      logger.info(`[event-bus-monitor] RECUPERADO: el bus vuelve a consumir (${verdict.detail}).`);
    }
    return;
  }

  if (verdict.status === 'unknown') {
    if (alertThrottle.shouldEmit('unknown')) {
      logger.error(
        `[event-bus-monitor] NO PUEDO MEDIR el event bus, y eso NO significa que esté sano: ${verdict.reason}`,
      );
    }
    return;
  }

  // El estado del supervisor va en el mismo aviso: dice si el worker ya se está
  // reconstruyendo solo (y cuántas veces lo hizo) o si esto es una caída de verdad.
  const supervisorSnapshot =
    resolved.ok && resolved.supervisor ? resolved.supervisor.snapshot() : null;
  const supervisorLine = supervisorSnapshot
    ? `\n\nSupervisor del worker: ${describeSupervisor(supervisorSnapshot)}`
    : '';
  const text = (report ?? verdict.detail) + supervisorLine;

  /**
   * La gracia se consulta ANTES que el throttle, y el `||` corta a propósito: en el
   * tick que posterga NO se llama a `shouldEmit`, así que el throttle queda intacto
   * y el tick siguiente entra como primera detección y manda el mail. Al revés
   * —consumiendo el slot del throttle acá— el aviso de una caída real se habría
   * comido los 30 minutos de la ventana sin haber mandado nada.
   */
  const deferral = mailGrace.consider({
    kind: verdict.kind,
    supervisor: supervisorSnapshot,
    uptimeMs: process.uptime() * 1000,
    bootGraceMs: bootGraceMs(),
  });
  if (!deferral.defer && !alertThrottle.shouldEmit(verdict.kind)) return;

  // La DETECCIÓN se registra siempre, postergue o no: lo que espera es el correo,
  // no el diagnóstico.
  logger.error(`[event-bus-monitor] ${text}`);

  if (deferral.defer) {
    logger.error(
      `[event-bus-monitor] El mail NO sale todavía: ${deferral.reason} ` +
        'Si esto fue un parpadeo, el tick siguiente va a decir RECUPERADO y nadie ' +
        'recibe nada; si no, el aviso sale con 5 minutos de atraso sobre una caída ' +
        'que históricamente duró horas.',
    );
  } else {
    await mailAdmin(
      container,
      logger,
      `[ALERTA] El event bus no está consumiendo (${verdict.kind})`,
      text,
    );
  }

  /**
   * El re-arme va DESPUÉS de avisar, y el orden importa: si el arranque prende, el
   * incidente igual quedó registrado. Un auto-arreglo silencioso es cómo un problema
   * recurrente se vuelve invisible — y este ya vive de ser invisible.
   *
   * Sólo para `worker-not-running`. Con `subscriber-stuck` o `queue-stalled` el worker
   * SÍ está corriendo: rearmarlo no aplica y taparía la causa real.
   *
   * Y si el servicio expone el supervisor del módulo envuelto, el re-arme es SUYO:
   * ver `delegateRearm`. El `run()` directo queda como fallback.
   */
  if (
    verdict.kind === 'worker-not-running' &&
    resolved.ok &&
    !delegateRearm(resolved.supervisor, logger)
  ) {
    await tryRearmWorker(resolved.worker, logger);
  }
}

export const config = {
  name: 'event-bus-monitor',
  /**
   * Cada 5 minutos. Con el umbral de 10 la detección cae dentro de los ~15 min,
   * contra los tres días que tardó la vez que pasó. Más seguido no compra nada: la
   * señal es una antigüedad medida en minutos, no un muestreo de picos.
   */
  schedule: process.env.EVENT_BUS_MONITOR_CRON || '*/5 * * * *',
};
