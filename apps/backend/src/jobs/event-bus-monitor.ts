import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  AlertThrottle,
  assessEventBusHealth,
  formatDownReport,
  readEventBusSnapshot,
  redisEventBusExpected,
  type EventBusQueueLike,
  type EventBusVerdict,
  type EventBusWorkerLike,
} from '../lib/event-bus-health';

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
  | { ok: true; queue: EventBusQueueLike; worker: EventBusWorkerLike | null }
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

  return { ok: true, queue, worker };
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
async function resolveRecipient(container: MedusaContainer): Promise<string | null> {
  try {
    /**
     * El `.js` no es un descuido: el paquete es CommonJS (`package.json` sin
     * `"type": "module"`), así que un `import()` es un import ESM de verdad y con
     * `moduleResolution: nodenext` TypeScript EXIGE la extensión del archivo
     * emitido (TS2835). Apunta al build (`dist/modules/email/admin-recipient.js`),
     * que es lo que corre en producción.
     *
     * Y si algún día esa resolución cambiara, no rompe nada: cae en el `catch` y
     * el aviso sale igual por `ADMIN_EMAIL` — el `logger.error` ni se entera.
     */
    const { getAdminNotificationEmail } = await import('../modules/email/admin-recipient.js');
    const to = await getAdminNotificationEmail(container);
    if (to) return to;
  } catch {
    // La extensión de email no está instalada, o su helper falló. Seguimos.
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

  const to = await resolveRecipient(container);
  if (!to) {
    logger.warn(
      '[event-bus-monitor] no hay destinatario de aviso configurado ' +
        '(`admin_notification_email` ni `ADMIN_EMAIL`): el aviso queda sólo en el log.',
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

  logger.error(
    '[event-bus-monitor] Reintentando arrancar el worker del event bus. ' +
      'Si prende, el tick siguiente lo va a reportar como RECUPERADO.',
  );

  void Promise.resolve()
    .then(() => worker.run!())
    .catch((error: unknown) => {
      logger.error(
        `[event-bus-monitor] El reintento de arranque falló: ${
          error instanceof Error ? error.message : String(error)
        }. Se vuelve a intentar en el próximo tick.`,
      );
    });

  return 'attempted';
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
    if (alertThrottle.reset()) {
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

  const text = report ?? verdict.detail;
  if (!alertThrottle.shouldEmit(verdict.kind)) return;

  logger.error(`[event-bus-monitor] ${text}`);
  await mailAdmin(
    container,
    logger,
    `[ALERTA] El event bus no está consumiendo (${verdict.kind})`,
    text,
  );

  /**
   * El re-arme va DESPUÉS de avisar, y el orden importa: si el arranque prende, el
   * incidente igual quedó registrado. Un auto-arreglo silencioso es cómo un problema
   * recurrente se vuelve invisible — y este ya vive de ser invisible.
   *
   * Sólo para `worker-not-running`. Con `subscriber-stuck` o `queue-stalled` el worker
   * SÍ está corriendo: rearmarlo no aplica y taparía la causa real.
   */
  if (verdict.kind === 'worker-not-running' && resolved.ok) {
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
