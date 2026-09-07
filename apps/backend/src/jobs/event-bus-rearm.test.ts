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
