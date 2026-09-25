import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El re-arme del worker del event bus.
 *
 * En producción, el 2026-09-03 20:47:33, el backend dejó ESTA línea y nada más:
 *
 *   Error running event bus worker: Connection is closed.
 *     at EventEmitter.connectionCloseHandler (ioredis/built/Redis.js:220)
 *
 * BullMQ consume con un comando bloqueante; Valkey cortó la conexión, el comando
 * rechazó y `run()` se cayó con él. `event-bus-redis.js:21` sólo loguea: no lo vuelve
 * a arrancar nunca. Un parpadeo de red de un segundo deja el bus muerto para siempre,
 * con el proceso sano y los crons corriendo. La primera vez fueron tres días y 5343
 * eventos encolados.
 *
 * Se verifica sobre el fuente porque el handler pide un `MedusaContainer`. Es un test
 * débil, y aun así fija las cuatro cosas que, si se rompen, devuelven el bug entero.
 */

const SRC = readFileSync(
  join(import.meta.dirname, 'event-bus-monitor.ts'),
  'utf8',
);

test('el re-arme NO se awaitea: `run()` sólo resuelve cuando el worker se cierra', () => {
  /**
   * Es el error que convertiría al vigilante en la falla que vigila: `await worker.run()`
   * cuelga el job para siempre. Tiene que dispararse y verificarse en el tick siguiente.
   */
  const body = SRC.slice(SRC.indexOf('async function tryRearmWorker'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /void Promise\.resolve\(\)/, 'perdió el disparo sin await');
  assert.doesNotMatch(
    fn,
    /await\s+worker\.run/,
    'awaitear `run()` cuelga el job hasta que el worker se cierre',
  );
  assert.match(fn, /\.catch\(/, 'un rechazo sin catch tumba el proceso');
});

test('sólo rearma cuando `isRunning()` es false', () => {
  // BullMQ tira "Worker is already running" si se llama `run()` sobre uno vivo.
  const body = SRC.slice(SRC.indexOf('async function tryRearmWorker'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /if \(worker\.isRunning\(\)\)\s*return/);
});

test('sólo rearma en `worker-not-running`, no en los otros veredictos', () => {
  /**
   * Con `subscriber-stuck` o `queue-stalled` el worker SÍ está corriendo: rearmarlo no
   * aplica, y taparía la causa real con un reintento que no hace nada.
   */
  const call = SRC.slice(SRC.indexOf('tryRearmWorker(resolved.worker'));
  const guard = SRC.slice(
    SRC.lastIndexOf('if (', SRC.indexOf('tryRearmWorker(resolved.worker')),
    SRC.indexOf('tryRearmWorker(resolved.worker'),
  );
  assert.match(guard, /verdict\.kind === 'worker-not-running'/);
  assert.ok(call.length > 0);
});

test('avisa ANTES de rearmar', () => {
  /**
   * Si el arranque prende, el incidente igual tiene que quedar registrado. Un
   * auto-arreglo silencioso es exactamente cómo un problema recurrente se vuelve
   * invisible — y éste ya vive de ser invisible.
   */
  const alert = SRC.indexOf('mailAdmin(');
  const rearm = SRC.indexOf('tryRearmWorker(resolved.worker');
  assert.ok(alert > -1 && rearm > -1);
  assert.ok(alert < rearm, 'el re-arme quedó antes del aviso: un incidente que se auto-tapa');
});

test('se puede apagar sin tocar código', () => {
  // Un auto-arranque que no se puede desactivar es un auto-arranque que alguien va a
  // querer borrar entero el día que moleste.
  assert.match(SRC, /EVENT_BUS_MONITOR_REARM === 'false'/);
});

test('`run` es opcional en el tipo: sin él el monitor sigue midiendo', () => {
  // `bullWorker_` es un campo interno de un paquete de terceros. Si algún día no
  // expone `run`, se pierde el auto-arranque y NO la detección.
  const health = readFileSync(
    join(import.meta.dirname, '..', 'lib', 'event-bus-health.ts'),
    'utf8',
  );
  assert.match(health, /run\?:\s*\(\)\s*=>\s*Promise/);
  const fn = SRC.slice(SRC.indexOf('async function tryRearmWorker'));
  assert.match(fn, /typeof worker\.run !== 'function'/, 'no chequea que `run` exista');
});

/**
 * ── LO QUE SE APRENDIÓ EL 2026-09-09, Y POR QUÉ SE FIJA ACÁ ──────────────────
 *
 * El re-arme corrió y NO sirvió. Log de producción, cada 5 minutos:
 *
 *   [event-bus-monitor] El reintento de arranque falló: Connection is closed.
 *
 * `run()` sobre un Worker cuya conexión está cerrada rechaza con el mismo error sin
 * intentar nada: reintentarlo así es pedirle a un teléfono desconectado que marque.
 * Los tests de abajo fijan las tres decisiones que salieron de ese incidente.
 */

test('revive la conexión ANTES de llamar a `run()`', () => {
  const body = SRC.slice(SRC.indexOf('async function tryRearmWorker'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  const revive = fn.indexOf('reviveConnection(worker');
  const run = fn.indexOf('worker.run!()');
  assert.ok(revive > -1, 'no revive la conexión: vuelve el bug del 09/09');
  assert.ok(run > -1);
  assert.ok(revive < run, '`run()` antes de revivir la conexión rechaza sin intentar nada');
});

test('nada le espera a la conexión sin techo de tiempo', () => {
  /**
   * `worker.client` es una promesa que BullMQ deja PENDIENTE PARA SIEMPRE si la
   * conexión no se establece. Awaitearla pelada cuelga el job — o sea que el monitor
   * se convierte en la falla que vigila, que es el único error imperdonable acá.
   */
  const body = SRC.slice(SRC.indexOf('async function reviveConnection'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.doesNotMatch(fn, /await\s+Promise\.resolve\(worker\.client\)\s*;/);
  assert.match(fn, /withDeadline\(/, 'consume la conexión sin deadline');
  const deadline = SRC.slice(SRC.indexOf('async function withDeadline'));
  assert.match(deadline.slice(0, deadline.indexOf('\n}\n')), /Promise\.race/);
});

test('un error DE CONEXIÓN se reporta distinto de un error de código', () => {
  /**
   * No es cosmética: decide a quién le sirve el log. Un `Connection is closed.` en el
   * re-arme significa que reintentar es inútil y que reiniciar el backend tampoco
   * alcanza — decirlo ahorra el paseo entero por el código, que es el que nos comió
   * la tarde del 09/09.
   */
  assert.match(SRC, /CONNECTION_LEVEL_ERROR/);
  assert.match(SRC, /connection is closed/i);
  assert.match(SRC, /max number of clients/i, 'el tope de conexiones del plan es el sospechoso principal');
  const body = SRC.slice(SRC.indexOf('async function tryRearmWorker'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /CONNECTION_LEVEL_ERROR\.test\(message\)/);
  assert.match(fn, /reiniciar el backend TAMPOCO/i);
});

test('NO construye un Worker ni una conexión nueva', () => {
  /**
   * Se PUEDE (event-bus-redis.js:127 crea el Worker con `new Worker(this.queueName_,
   * this.worker_, ...)`, y las dos son propiedades del service). No se hace: un Worker
   * nuevo pide una CONEXIÓN nueva, y la causa raíz observada es un Valkey que está
   * RECHAZANDO conexiones. Un monitor que abre clientes cada cinco minutos contra un
   * Valkey al límite convierte una caída de una hora en una permanente.
   *
   * Este test existe para que el próximo que lea "el re-arme no cura" no lo
   * "mejore" por ese lado sin leer el porqué.
   */
  /**
   * SIN COMENTARIOS, y no es un detalle: el porqué de esta decisión está escrito en
   * el fuente y NOMBRA `new Worker(this.queueName_, this.worker_, ...)` como la
   * tentación que se descarta. Buscar sobre el fuente crudo hacía fallar el test
   * contra su propia explicación.
   */
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(CODE, /new\s+Worker\s*\(/);
  assert.doesNotMatch(CODE, /from\s+'bullmq'/);
  assert.doesNotMatch(CODE, /from\s+'ioredis'/);
});

test('el destinatario del aviso ya no se resuelve en silencio', () => {
  /**
   * El monitor detectó la caída del 09/09 en cada tick y el aviso murió en el log
   * porque `resolveRecipient` no encontró destinatario — con `info@desdelsur.com.ar`
   * configurado en la fila de la única tienda, o sea que algo falló adentro del
   * `try` y el `catch` vacío se lo comió. Un `catch` que devuelve lo mismo que el
   * camino de al lado no maneja el error: lo entierra.
   */
  const body = SRC.slice(SRC.indexOf('async function resolveRecipient'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.doesNotMatch(fn, /\}\s*catch\s*\{/, 'volvió el catch que se traga el motivo');
  assert.match(fn, /catch\s*\(error\)/);
  assert.match(fn, /logger\.warn/);
});

/**
 * ── LA CORRECCIÓN DEL 2026-09-09, MISMO DÍA ─────────────────────────────────
 *
 * El re-arme con revive se deployó y el log lo desmintió en el primer tick:
 *
 *   [event-bus-monitor] Reintentando arrancar... Conexión: en `ready`, no hace falta tocarla.
 *   [event-bus-monitor] El reintento falló CONTRA LA CONEXIÓN: Connection is closed.
 *
 * Estaba mirando `worker.client` — y la que se muere es la BLOQUEANTE, que BullMQ
 * duplica aparte (`worker.js:120`). Revivir la conexión equivocada no da un
 * error: da un diagnóstico que dice "está todo bien" mientras nada funciona, que
 * es peor.
 */

test('revive la conexión BLOQUEANTE, no la del worker', () => {
  const body = SRC.slice(SRC.indexOf('async function reviveConnection'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  const blocking = fn.indexOf('blockingConnection');
  const client = fn.indexOf('worker.client');
  assert.ok(blocking > -1, 'no mira la conexión bloqueante: vuelve el falso `ready` del 09/09');
  assert.ok(
    client === -1 || blocking < client,
    '`worker.client` antes de la bloqueante: prioriza la conexión que NO se muere',
  );
  assert.match(fn, /reconnect/, 'no usa el reconnect() de BullMQ');
});

test('dice CUÁL conexión miró', () => {
  /**
   * Sin esto, un `ready` en el log no se puede interpretar: no se sabe si es la
   * conexión que importa. Es exactamente lo que nos hizo perder el tick del 09/09.
   */
  const body = SRC.slice(SRC.indexOf('async function reviveConnection'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /source\.label/);
  assert.match(fn, /NO la bloqueante/);
});

test('el destinatario se carga por `require`, que es la única forma que resuelve en producción', () => {
  /**
   * Acá hubo un doble intento `import('….js')` + `import('…')` y SEGUÍA fallando
   * con el fix instalado —log del 2026-09-18 12:28:03— porque las dos ramas eran
   * ESM y el resolver ESM no inventa extensiones: en producción el archivo es `.ts`.
   * La medición está en `lib/lazy-module.ts`.
   */
  const body = SRC.slice(SRC.indexOf('async function importAdminRecipient'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /loadLazyModule</, 'tiene que ir por el helper compartido');
  assert.match(fn, /require\('\.\.\/modules\/email\/admin-recipient'\)/, 'falta la forma CJS, que es la que resuelve');
  assert.doesNotMatch(fn, /admin-recipient\.js/, 'el `.js` relativo no resuelve cuando el backend corre el fuente');
});
