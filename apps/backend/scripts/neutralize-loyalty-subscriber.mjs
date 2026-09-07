#!/usr/bin/env node

// El subscriber `order.placed` de @medusajs/loyalty-plugin emite gift cards (valor
// monetario real) sin mirar el estado de pago. Este proyecto emite recién con la
// orden cobrada, desde `src/modules/gift-card-experience/process-order.ts`.
//
// En dev eso lo neutraliza `patches/@medusajs__loyalty-plugin@<ver>.patch` vía
// `pnpm.patchedDependencies`. Pero `patchedDependencies` es una feature de pnpm y
// vive en el manifest de la RAÍZ, y DigitalOcean buildea apps/backend con el
// buildpack de Node corriendo `npm ci`: no tiene mecanismo de patches y nunca lee
// ese manifest. Resultado: hasta ahora el subscriber estaba VIVO en producción.
//
// Y la idempotencia del proyecto no lo cubría: busca por
// `metadata->>'idempotency_key'` y el plugin crea con `metadata: {}`, así que las
// dos rutas no se ven entre sí.
//
// Este script cierra ese hueco corriendo en los dos gestores. Dos modos:
//   (sin flags)  aplica la neutralización (lo usa `postinstall`)
//   --verify     no escribe; falla si NO está neutralizado (lo usa `build`)
//
// El modo --verify existe porque un `postinstall` se puede saltear (por ejemplo con
// `npm ci --ignore-scripts`), y un arreglo que falla en silencio es exactamente el
// problema que vinimos a resolver. Enganchado al build, un deploy sin la guarda
// ABORTA en vez de salir a producción emitiendo plata.
//
// ALCANCE: sólo el hunk monetario. El .patch de pnpm además saca un `options,` del
// `mutateAsync` de `GiftCardProductEditDenominationsForm` en el bundle de admin —
// un bug de UI, no de plata, que hoy ya está presente en producción sin impacto
// reportado. Replicarlo acá sería cirugía de strings sobre un bundle generado de
// ~40k líneas sin un ancla estable: justo la fragilidad de la que nos estamos
// yendo. Queda fuera a propósito.

import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TAG = '[neutralize-loyalty-subscriber]';
const verifyOnly = process.argv.includes('--verify');

const target = join(
  import.meta.dirname, '..',
  'node_modules', '@medusajs', 'loyalty-plugin',
  '.medusa', 'server', 'src', 'subscribers', 'create-gift-card.js'
);

/** El `return;` corta antes de que el handler lea la orden. */
const NEUTRALIZED =
  /async function createGiftCardHandler\([^)]*\)\s*\{(?:[^\n]*\n){0,10}?\s*return;\s*\n\s*const orderId/;

/** Ancla de inyección: la apertura del handler y la primera sentencia real. */
const INJECTION_POINT = /(async function createGiftCardHandler\([^)]*\)\s*\{\r?\n)([ \t]*)(const orderId)/;

const MARKER = [
  '    // NEUTRALIZED by apps/backend/scripts/neutralize-loyalty-subscriber.mjs:',
  '    // gift cards are issued only after payment, from',
  '    // src/modules/gift-card-experience/process-order.ts. Do not remove.',
].join('\n');

function fail(message) {
  console.error(`${TAG} ${message}`);
  process.exit(1);
}

// Un proyecto generado sin la extensión `gift-cards` no instala el plugin.
if (!existsSync(target)) {
  console.log(`${TAG} @medusajs/loyalty-plugin no está instalado: nada que hacer.`);
  process.exit(0);
}

const source = readFileSync(target, 'utf8');

// Controles POSITIVOS. Si el bundle cambió de forma, no queremos "no encontré nada,
// todo bien": queremos que alguien mire. Un falso OK acá es plata emitida gratis.
if (!/async function createGiftCardHandler\(/.test(source)) {
  fail(
    'no encontré createGiftCardHandler en el plugin instalado. El bundle cambió de forma, así que ' +
      'esta guarda ya no aplica y NO se puede asumir que el subscriber esté neutralizado. ' +
      'Revisar el subscriber del plugin y actualizar este script.'
  );
}
if (!/createGiftCardsWorkflow/.test(source)) {
  fail(
    'el subscriber del plugin ya no referencia createGiftCardsWorkflow. Puede que ya no emita, pero ' +
      'hay que confirmarlo a mano antes de dar por buena la guarda.'
  );
}

if (NEUTRALIZED.test(source)) {
  console.log(`${TAG} ya está neutralizado: no-op.`);
  process.exit(0);
}

if (verifyOnly) {
  fail(
    'EL SUBSCRIBER order.placed DEL PLUGIN ESTÁ ACTIVO. Va a emitir gift cards (valor monetario real) ' +
      'antes de que se capture el pago, y la idempotencia de process-order.ts no lo cubre. ' +
      'El postinstall no corrió o no aplicó. Correr: node ./scripts/neutralize-loyalty-subscriber.mjs'
  );
}

if (!INJECTION_POINT.test(source)) {
  fail(
    'encontré createGiftCardHandler pero no el punto de inyección (`const orderId` como primera ' +
      'sentencia). El cuerpo del handler cambió: actualizar este script en vez de relajar el match.'
  );
}

const patched = source.replace(INJECTION_POINT, `$1${MARKER}\n$2return;\n$2$3`);

if (!NEUTRALIZED.test(patched)) {
  fail('la inyección no produjo un archivo neutralizado. No se escribió nada.');
}

// Bajo pnpm los archivos de node_modules son hard links al store global: escribir
// in-place corrompería la copia compartida para TODOS los proyectos de esta
// máquina. Se borra primero para romper el link y escribir en un inode nuevo.
// (En el camino de pnpm normalmente ya salimos antes, porque el patch dejó el
// archivo neutralizado; esto es la red por si alguna vez no.)
const { nlink } = statSync(target);
rmSync(target);
writeFileSync(target, patched, 'utf8');

console.log(
  `${TAG} neutralizado el subscriber order.placed del plugin` +
    (nlink > 1 ? ` (se rompió un hard link al store: nlink era ${nlink}).` : '.')
);
