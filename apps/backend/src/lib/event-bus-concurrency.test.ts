import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La concurrencia del worker del event bus no puede volver a quedar en 1.
 *
 * Con el default de BullMQ —que es 1— toda la instalación procesa un evento por vez,
 * y un solo subscriber colgado congela lo asincrónico de la tienda entera. El
 * 2026-08-31 21:35:33 se cortaron en el MISMO segundo las notificaciones por event
 * bus, el outbox del ERP y el WhatsApp de desdeelsur, y estuvieron tres días sin
 * volver: seis órdenes sin mail, sin WhatsApp y sin llegar al ERP.
 *
 * Se verifica sobre el fuente porque evaluar `medusa-config.ts` levanta la app entera.
 * Es un test débil comparado con uno de comportamiento, y aun así ataja el modo de
 * falla real: que alguien borre la opción y nadie se entere hasta la próxima caída
 * silenciosa de tres días.
 */

const CONFIG = readFileSync(
  join(import.meta.dirname, '..', '..', 'medusa-config.ts'),
  'utf8',
);

/** El bloque `event_bus: { ... }`, para no confundirlo con otros módulos. */
function eventBusBlock(): string {
  const start = CONFIG.indexOf('event_bus: {');
  assert.ok(start > -1, 'desapareció el bloque `event_bus` de medusa-config.ts');
  return CONFIG.slice(start, CONFIG.indexOf('\n      : {}),', start));
}

test('el event bus declara `workerOptions` con una concurrencia > 1', () => {
  const block = eventBusBlock();
  assert.match(
    block,
    /workerOptions:\s*\{\s*concurrency:/,
    'sin `workerOptions` BullMQ usa concurrency 1 y un subscriber colgado frena toda la tienda',
  );

  const name = block.match(/concurrency:\s*([A-Za-z0-9_]+)/)?.[1];
  assert.ok(name, 'no se pudo leer el valor de concurrency');

  const value = /^\d+$/.test(name)
    ? Number(name)
    : Number(CONFIG.match(new RegExp(`const ${name} = (\\d+)`))?.[1]);

  assert.ok(Number.isFinite(value), `no se pudo resolver el valor de ${name}`);
  assert.ok(value > 1, `concurrency = ${value}: con 1 vuelve el bug de la cola serializada`);
});

test('`workerOptions` va en las opciones del MÓDULO, no dentro de `redisOptions`', () => {
  /**
   * Es el error silencioso de este cambio: `redisOptions` es la config de la conexión
   * de ioredis y BullMQ jamás la mira para la concurrencia. Puesto ahí, el archivo se
   * ve arreglado, el arranque no falla, y el worker sigue en 1.
   *
   * El loader del paquete instalado destructura `workerOptions` de las opciones del
   * módulo (`event-bus-redis/dist/loaders/index.js:10`) y lo registra como
   * `eventBusRedisWorkerOptions`, que es lo que el servicio spreadea sobre el
   * `new Worker`.
   */
  const block = eventBusBlock();
  const redisOptionsIdx = block.indexOf('redisOptions');
  const workerOptionsIdx = block.indexOf('workerOptions');
  assert.ok(workerOptionsIdx > -1);
  // `redisOptions` se pasa como shorthand (`redisOptions,`), así que si `workerOptions`
  // quedara adentro de un objeto `redisOptions: { ... }` habría un `{` entre medio.
  const between = block.slice(redisOptionsIdx, workerOptionsIdx);
  assert.doesNotMatch(
    between,
    /redisOptions:\s*\{/,
    '`workerOptions` quedó adentro de `redisOptions`: BullMQ no lo lee y el worker sigue en 1',
  );
});

test('el porqué queda escrito al lado de la opción', () => {
  // Un número suelto invita a "simplificar". El comentario es lo que evita que alguien
  // lo borre por prolijidad dentro de seis meses.
  const block = eventBusBlock();
  assert.match(block, /BullMQ/);
  assert.match(block, /2026-08-31/, 'falta el incidente que justifica el valor');
});
