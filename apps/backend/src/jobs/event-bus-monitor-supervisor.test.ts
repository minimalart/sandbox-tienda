import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * El monitor y el supervisor tienen que tener UN solo dueño del worker.
 *
 * Antes del módulo envuelto (`modules/event-bus-redis`), el monitor era el único
 * que podía re-arrancar el worker, y lo hacía con `run()` directo sobre el mismo
 * objeto — que, con la conexión bloqueante envenenada, rechaza para siempre (cada
 * tick del 2026-09-09 lo probó). Ahora el supervisor reconstruye el worker por su
 * cuenta y el monitor le delega. Estos tests fijan ese reparto sobre el fuente,
 * igual que `event-bus-rearm.test.ts`, porque el job pide un `MedusaContainer`.
 */

const SRC = readFileSync(join(import.meta.dirname, 'event-bus-monitor.ts'), 'utf8');

test('el monitor resuelve el supervisor del servicio junto con la cola y el worker', () => {
  assert.match(SRC, /workerSupervisor\?: EventBusWorkerSupervisorLike \| null/);
  assert.match(SRC, /service\.workerSupervisor/);
  assert.match(SRC, /return \{ ok: true, queue, worker, supervisor \}/);
});

test('con supervisor, el re-arme se le delega y el run() directo queda de fallback', () => {
  const guard = SRC.slice(
    SRC.lastIndexOf('if (', SRC.indexOf('tryRearmWorker(resolved.worker')),
    SRC.indexOf('tryRearmWorker(resolved.worker'),
  );
  assert.match(guard, /!delegateRearm\(resolved\.supervisor, logger\)/, 'el run() directo ya no está condicionado al supervisor');

  const body = SRC.slice(SRC.indexOf('function delegateRearm'));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.match(fn, /requestSupervisorRestart\(supervisor\)/, 'no le pide al supervisor que corte el backoff');
  assert.match(fn, /return request\.handled/, 'tiene que devolver si el supervisor se hizo cargo');
  assert.doesNotMatch(fn, /\.run\(/, 'el monitor no puede arrancar el worker por su cuenta cuando hay supervisor');
});

test('el aviso incluye el estado del supervisor', () => {
  // Para que el mail diga "ya se está reconstruyendo, van N" en vez de sólo "está caído".
  assert.match(SRC, /describeSupervisor\(resolved\.supervisor\.snapshot\(\)\)/);
  const text = SRC.slice(SRC.indexOf('const supervisorLine'), SRC.indexOf('alertThrottle.shouldEmit(verdict.kind)'));
  assert.match(text, /\(report \?\? verdict\.detail\) \+ supervisorLine/);
});

test('medusa-config apunta event_bus al módulo envuelto, no al paquete pelado', () => {
  const config = readFileSync(join(import.meta.dirname, '..', '..', 'medusa-config.ts'), 'utf8');
  const block = config.slice(config.indexOf('event_bus: {'));
  const resolve = block.slice(0, block.indexOf('options:'));
  assert.match(resolve, /resolve: '\.\/src\/modules\/event-bus-redis'/, 'volvió el @medusajs/medusa/event-bus-redis pelado: sin supervisor, run() muere una vez y no vuelve');
});
