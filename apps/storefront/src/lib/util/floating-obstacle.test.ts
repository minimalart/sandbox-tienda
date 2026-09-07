import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FLOATING_GAP,
  FLOATING_LAYER,
  type FloatingObstacleBand,
  resolveFloatingBottomOffset,
  toFloatingBand,
} from "./floating-obstacle";

/**
 * Regresión de un bug vivo en producción: el BANNER DE COOKIES quedaba en
 * `bottom-0` con z-index por debajo del nav inferior mobile, así que el nav lo
 * tapaba y no había forma de tocar Aceptar/Rechazar.
 *
 * El fix lo mete en la escalera de `FLOATING_LAYER`. Lo que se fija acá es la
 * propiedad que hace que la escalera funcione: el esquive es UNIDIRECCIONAL. Si
 * dos elementos se esquivaran mutuamente, cada movimiento del uno empujaría al
 * otro y los dos terminarían trepando hasta el techo del viewport.
 */

const VIEWPORT = 800;
const FULL_WIDTH = { left: 0, right: 400 };

/** Barra pegada al borde inferior, tipo nav mobile. */
const bar = (
  height: number,
  layer: number,
  bottom = 0,
): FloatingObstacleBand => ({
  bottom,
  top: bottom + height,
  ...FULL_WIDTH,
  layer,
});

test("el banner de cookies se corre arriba del nav inferior", () => {
  const nav = bar(76, FLOATING_LAYER.edgeBar);

  const offset = resolveFloatingBottomOffset({
    self: { height: 100, ...FULL_WIDTH },
    obstacles: [nav],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, nav.top + FLOATING_GAP);
});

test("el banner apila nav + barra sticky en una sola pasada", () => {
  const offset = resolveFloatingBottomOffset({
    self: { height: 100, ...FULL_WIDTH },
    obstacles: [
      bar(76, FLOATING_LAYER.edgeBar),
      bar(48, FLOATING_LAYER.stackedBar, 88),
    ],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, 88 + 48 + FLOATING_GAP);
});

test("no hay empuje mutuo: el banner ignora al botón flotante de arriba", () => {
  const nav = bar(76, FLOATING_LAYER.edgeBar);
  const self = { height: 100, ...FULL_WIDTH };
  const settled = nav.top + FLOATING_GAP;

  // El botón de WhatsApp ya se corrió por encima del banner. Si el banner lo
  // esquivara a su vez, volvería a subir en cada pasada.
  const whatsapp: FloatingObstacleBand = {
    bottom: settled + self.height + FLOATING_GAP,
    top: settled + self.height + FLOATING_GAP + 48,
    left: 330,
    right: 378,
    layer: FLOATING_LAYER.floatingButton,
  };

  const offset = resolveFloatingBottomOffset({
    self,
    obstacles: [nav, whatsapp],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, settled);
});

test("el botón flotante sí esquiva al banner de cookies", () => {
  const banner = bar(100, FLOATING_LAYER.notice, 88);

  const offset = resolveFloatingBottomOffset({
    self: { height: 48, left: 330, right: 378 },
    obstacles: [bar(76, FLOATING_LAYER.edgeBar), banner],
    layer: FLOATING_LAYER.floatingButton,
    baseOffset: 20,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, banner.top + FLOATING_GAP);
});

test("un obstáculo en otra columna no mueve nada", () => {
  const offset = resolveFloatingBottomOffset({
    self: { height: 48, left: 330, right: 378 },
    obstacles: [
      { bottom: 0, top: 60, left: 0, right: 60, layer: FLOATING_LAYER.tray },
    ],
    layer: FLOATING_LAYER.floatingButton,
    baseOffset: 20,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, 20);
});

test("nunca se empuja el elemento fuera de la pantalla", () => {
  const offset = resolveFloatingBottomOffset({
    self: { height: 100, ...FULL_WIDTH },
    obstacles: [bar(780, FLOATING_LAYER.edgeBar)],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: VIEWPORT,
  });

  assert.equal(offset, VIEWPORT - 100 - FLOATING_GAP);
});

test("toFloatingBand invierte el eje al sistema de `bottom`", () => {
  const band = toFloatingBand(
    { top: 700, bottom: 776, left: 0, right: 400 },
    VIEWPORT,
  );

  assert.deepEqual(band, { top: 100, bottom: 24, left: 0, right: 400 });
});
