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
  assert.match(SRC, /describeSupervisor\(supervisorSnapshot\)/);
  const text = SRC.slice(SRC.indexOf('const supervisorSnapshot'), SRC.indexOf('alertThrottle.shouldEmit(verdict.kind)'));
  assert.match(text, /\(report \?\? verdict\.detail\) \+ supervisorLine/);
});

/**
 * ── EL PERÍODO DE GRACIA DEL MAIL ───────────────────────────────────────────
 *
 * El 2026-09-18 el supervisor se curó en UN SEGUNDO y el monitor mandó el mail
 * igual, porque su primer tick cayó justo en ese segundo. La lógica de la gracia
 * se prueba con dobles en `lib/event-bus-health.test.ts`; lo que se fija acá es el
 * CABLEADO, que es donde está la trampa: el `AlertThrottle` ya existía y silencia
 * 30 minutos por `kind`. Si el tick que posterga consumiera el slot del throttle,
 * el tick siguiente no podría mandar nada y la gracia se habría comido el aviso de
 * una caída real en vez de demorarlo.
 */
test('el tick que posterga NO consume el slot del throttle', () => {
  const guard = SRC.slice(SRC.indexOf('const deferral = mailGrace.consider'));
  const decision = guard.slice(0, guard.indexOf('\n\n'));
  assert.match(
    decision,
    /if \(!deferral\.defer && !alertThrottle\.shouldEmit\(verdict\.kind\)\) return;/,
    'el `&&` corta antes de `shouldEmit` cuando se posterga: así el throttle queda intacto para el tick siguiente',
  );
});

test('lo que se demora es el MAIL, no la detección: el logger.error va antes del if', () => {
  const tail = SRC.slice(SRC.indexOf('if (!deferral.defer && !alertThrottle.shouldEmit'));
  const logIndex = tail.indexOf('logger.error(`[event-bus-monitor] ${text}`)');
  const branchIndex = tail.indexOf('if (deferral.defer)');
  assert.ok(logIndex > -1 && branchIndex > -1, 'cambió la forma del tramo de aviso');
  assert.ok(
    logIndex < branchIndex,
    'el reporte completo tiene que quedar en el log también en el tick que posterga',
  );
  assert.match(tail.slice(branchIndex), /\} else \{\s*await mailAdmin\(/, 'el mail tiene que quedar en la rama que NO posterga');
});

test('la recuperación mira la gracia además del throttle', () => {
  // Si el único rastro de la caída fue una postergación, `alertThrottle.reset()`
  // devuelve false y sin esto se perdería la línea de RECUPERADO del blip.
  const ok = SRC.slice(SRC.indexOf("if (verdict.status === 'ok')"));
  const body = ok.slice(0, ok.indexOf('\n  }'));
  assert.match(body, /const hadAlert = alertThrottle\.reset\(\);/);
  assert.match(body, /const hadDeferred = mailGrace\.reset\(\);/);
  assert.match(body, /if \(hadAlert \|\| hadDeferred\)/);
});

test('medusa-config apunta event_bus al módulo envuelto, no al paquete pelado', () => {
  const config = readFileSync(join(import.meta.dirname, '..', '..', 'medusa-config.ts'), 'utf8');
  const block = config.slice(config.indexOf('event_bus: {'));
  const resolve = block.slice(0, block.indexOf('options:'));
  assert.match(resolve, /resolve: '\.\/src\/modules\/event-bus-redis'/, 'volvió el @medusajs/medusa/event-bus-redis pelado: sin supervisor, run() muere una vez y no vuelve');
});
