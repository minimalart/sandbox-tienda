import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { capturedAmount, isFullyPaidOrder } from './process-order';

/**
 * La regla que protege plata: una gift card sólo se emite cuando la orden está
 * PAGADA. En `processGiftCardsForOrder` los intents se crean siempre y la emisión
 * está detrás de `if (!isFullyPaidOrder(order)) return`, así que estas dos
 * funciones puras SON la guarda.
 *
 * `gift-card-experience.test.ts` ya cubre parcial→false, completo→true y
 * `canceled_at`→false. Lo que falta acá son los casos que corresponden exactamente
 * al modo de falla real: un pago AUTORIZADO pero no capturado (que es el estado en
 * el que está una orden cuando se emite `order.placed`) y un pago capturado y
 * después anulado. Si `capturedAmount` contara cualquiera de los dos, se emitiría
 * valor monetario sin cobrar.
 *
 * Contexto de por qué importa: el subscriber `order.placed` de
 * `@medusajs/loyalty-plugin` emite sin mirar el estado de pago. Está neutralizado
 * por un patch de pnpm que NO se aplica en producción (DigitalOcean buildea con
 * `npm ci`, que no tiene mecanismo de patches). El último test de este archivo es
 * la guarda de eso.
 *
 * NOTA: este archivo NO está en `managed_files` de la extensión `gift-cards`, así
 * que no viaja a los proyectos generados. Se hizo así porque el archivo espejado
 * requiere `site:components:extract`, que en macOS reescribe ~40 manifests por
 * churn de EOL. Fundirlo en `gift-card-experience.test.ts` desde una checkout
 * Windows es la tarea pendiente.
 */

test('un pago autorizado pero NO capturado no cuenta como pagado', () => {
  // Estado tipico de una orden cuando se emite `order.placed`: hay un pago por el
  // total, pero todavia sin capturar.
  const authorizedOnly = {
    total: 100,
    payment_collections: [{ payments: [{ amount: 100, captured_at: null }] }],
  } as never;
  assert.equal(capturedAmount(authorizedOnly), 0);
  assert.equal(isFullyPaidOrder(authorizedOnly), false);

  // `captured_at` ausente del todo tiene que comportarse igual que null.
  const missingCapturedAt = { total: 100, payment_collections: [{ payments: [{ amount: 100 }] }] } as never;
  assert.equal(capturedAmount(missingCapturedAt), 0);
  assert.equal(isFullyPaidOrder(missingCapturedAt), false);
});

test('un pago capturado y despues anulado no cuenta como pagado', () => {
  const capturedThenCanceled = {
    total: 100,
    payment_collections: [
      { payments: [{ amount: 100, captured_at: new Date(), canceled_at: new Date() }] },
    ],
  } as never;
  assert.equal(capturedAmount(capturedThenCanceled), 0);
  assert.equal(isFullyPaidOrder(capturedThenCanceled), false);

  // Mezcla: uno vivo y uno anulado -> solo suma el vivo, y no alcanza el total.
  const mixed = {
    total: 100,
    payment_collections: [
      {
        payments: [
          { amount: 60, captured_at: new Date() },
          { amount: 40, captured_at: new Date(), canceled_at: new Date() },
        ],
      },
    ],
  } as never;
  assert.equal(capturedAmount(mixed), 60);
  assert.equal(isFullyPaidOrder(mixed), false);
});

test('una orden cancelada por status no emite, aunque este cobrada', () => {
  // `isFullyPaidOrder` corta por `canceled_at` O por `status`. El test existente
  // solo cubre `canceled_at`.
  const canceledByStatus = {
    total: 100,
    status: 'canceled',
    payment_collections: [{ payments: [{ amount: 100, captured_at: new Date() }] }],
  } as never;
  assert.equal(capturedAmount(canceledByStatus), 100);
  assert.equal(isFullyPaidOrder(canceledByStatus), false);
});

test('sin pagos no hay emision, y un sobrepago si emite', () => {
  assert.equal(isFullyPaidOrder({ total: 100 } as never), false);
  assert.equal(isFullyPaidOrder({ total: 100, payment_collections: [] } as never), false);
  assert.equal(isFullyPaidOrder({ total: 100, payment_collections: [{ payments: [] }] } as never), false);
  assert.equal(isFullyPaidOrder({ total: 100, payment_collections: [{ payments: null }] } as never), false);

  const overpaid = {
    total: 100,
    payment_collections: [{ payments: [{ amount: 120, captured_at: new Date() }] }],
  } as never;
  assert.equal(isFullyPaidOrder(overpaid), true);
});

/**
 * El subscriber `order.placed` del plugin emite gift cards sin mirar el pago. Está
 * neutralizado por `scripts/neutralize-loyalty-subscriber.mjs` (que corre en
 * `postinstall`) y, en dev, además por el patch de pnpm. La neutralización apunta a
 * un bundle generado de ~40k líneas: al bumpear la versión de Medusa los offsets se
 * corren y puede dejar de aplicar.
 *
 * Este test DELEGA en el `--verify` de ese script en vez de repetir la detección.
 * Si duplicáramos el regex, el test y la guarda del build podrían divergir en un
 * bump y quedaríamos con un test verde sobre una guarda caída — que es exactamente
 * la clase de falla que estamos tratando de evitar. Los controles positivos (que el
 * handler y el call site sigan existiendo) están dentro del script.
 */
test('el subscriber order.placed del plugin sigue neutralizado', () => {
  const backendRoot = join(import.meta.dirname, '..', '..', '..');
  const script = join(backendRoot, 'scripts', 'neutralize-loyalty-subscriber.mjs');

  // Un proyecto generado sin la extension `gift-cards` no instala el plugin; el
  // script sale 0 en ese caso, asi que no hace falta un guard aca.
  assert.ok(existsSync(script), `falta ${script}: es la guarda que corre en postinstall y en build.`);

  const result = spawnSync(process.execPath, [script, '--verify'], {
    cwd: backendRoot,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `la guarda de emision fallo. Salida del script:\n${result.stderr || result.stdout}`
  );
});
