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

/**
 * Regresión de DESDEELSUR-61 / BUG-05, medida sobre el home de producción.
 *
 * Números reales tomados del sitio en vivo (viewport 1440x900):
 *
 *   cookie-consent  layer 3  rect y[686,776]  x[0,1440]   alto 90
 *   back-to-top     layer 2  rect y[788,828]  x[1376,1416]  alto 40
 *
 * El aviso de cookies terminaba en `bottom: 124px` — flotando en el medio de la
 * página y tapando una card entera del catálogo — porque esquivaba un botón de
 * 40px parado en la esquina derecha. `overlapsHorizontally` daba `true` con
 * cualquier solape mayor a 0, y una barra de ancho completo solapa a TODO lo que
 * esté abajo.
 *
 * Un elemento de ancho completo no tiene ninguna columna libre a la que
 * correrse: subirlo no lo destapa, sólo tapa el contenido de más arriba. QA lo
 * reportó como "el cartel de cookies tapa el CTA principal del home".
 */
test("BUG-05: una barra de ancho completo NO esquiva un botón lateral chico", () => {
  const backToTop: FloatingObstacleBand = {
    // Medidas de producción, ya en el sistema de `bottom` (viewport 900).
    bottom: 72,
    top: 112,
    left: 1376,
    right: 1416,
    layer: FLOATING_LAYER.tray,
  };

  const offset = resolveFloatingBottomOffset({
    self: { height: 90, left: 0, right: 1440 },
    obstacles: [backToTop],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: 900,
  });

  // Pegado al borde, que es lo que pidió QA ("debería ser sticky").
  assert.equal(offset, 0);
});

test("BUG-05: pero sí esquiva una barra de ancho completo (nav mobile)", () => {
  // El caso para el que se escribió el módulo no se toca: acá el obstáculo cubre
  // el 100% del ancho propio.
  const nav: FloatingObstacleBand = {
    bottom: 0,
    top: 76,
    left: 0,
    right: 390,
    layer: FLOATING_LAYER.edgeBar,
  };

  const offset = resolveFloatingBottomOffset({
    self: { height: 90, left: 0, right: 390 },
    obstacles: [nav],
    layer: FLOATING_LAYER.notice,
    baseOffset: 0,
    viewportHeight: 844,
  });

  assert.equal(offset, 76 + FLOATING_GAP);
});

test("BUG-05: un botón flotante chico sigue esquivando al nav de ancho completo", () => {
  // La asimetría es deliberada: la fracción se mide contra el ancho PROPIO. El
  // nav cubre el 100% del ancho del botón, así que el botón sube; el botón cubre
  // el 14% del ancho del nav, así que el nav no se movería por él.
  const nav: FloatingObstacleBand = {
    bottom: 0,
    top: 76,
    left: 0,
    right: 390,
    layer: FLOATING_LAYER.edgeBar,
  };

  const offset = resolveFloatingBottomOffset({
    self: { height: 56, left: 320, right: 376 },
    obstacles: [nav],
    layer: FLOATING_LAYER.floatingButton,
    baseOffset: 0,
    viewportHeight: 844,
  });

  assert.equal(offset, 76 + FLOATING_GAP);
});
