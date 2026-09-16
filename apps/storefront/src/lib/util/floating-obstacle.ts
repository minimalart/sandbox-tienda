/**
 * Contrato de "obstáculos flotantes".
 *
 * El storefront tiene varios elementos anclados abajo (nav mobile, barra sticky
 * de agregar al carrito, volver arriba, bandeja de comparación, sticky de
 * marcas, banner de cookies). Cualquier botón flotante que se agregue después
 * tiene que esquivarlos, y hacerlo con offsets hardcodeados se rompe en cuanto
 * uno de ellos cambia de alto o aparece/desaparece.
 *
 * Solución: los elementos anclados se marcan con este atributo y quien flote
 * mide sus rects en runtime y se corre. El atributo es inerte (no pinta nada),
 * así que marcar un componente no tiene costo si nadie lo lee.
 */
export const FLOATING_OBSTACLE_ATTR = "data-floating-obstacle";

/** Capa del obstáculo dentro de la escalera de `FLOATING_LAYER`. */
export const FLOATING_LAYER_ATTR = "data-floating-layer";

/** Selector para leer todos los obstáculos marcados. */
export const FLOATING_OBSTACLE_SELECTOR = `[${FLOATING_OBSTACLE_ATTR}]`;

/**
 * Escalera de capas del borde inferior, de abajo hacia arriba.
 *
 * Existe porque "todos esquivan a todos" NO converge: si A esquiva a B y B
 * esquiva a A, cada vez que uno se mueve el otro vuelve a subir y los dos
 * terminan trepando hasta el techo del viewport. La regla es unidireccional:
 * quien mide su offset esquiva SOLO los obstáculos de capa MENOR a la propia e
 * ignora los de capa igual o mayor (esos ya se corren ellos).
 *
 * Al agregar un elemento anclado abajo, elegí la capa por su rol, no por su
 * z-index: la capa resuelve geometría, el z-index resuelve pintado.
 */
export const FLOATING_LAYER = {
  /** Barras pegadas al borde: nav mobile, agregar al carrito, filtros sports. */
  edgeBar: 0,
  /** Barras que ya viven arriba del nav (sticky de marcas). */
  stackedBar: 1,
  /** Bandejas y nudges laterales (comparar, envío gratis, volver arriba). */
  tray: 2,
  /** Avisos que tienen que quedar accionables sobre todo lo anterior (cookies). */
  notice: 3,
  /** Botones flotantes: esquivan todo lo anterior. */
  floatingButton: 4,
} as const;

export type FloatingLayer = (typeof FLOATING_LAYER)[keyof typeof FLOATING_LAYER];

/**
 * Props a spreadear en el contenedor `fixed` del elemento anclado. El nombre es
 * puramente informativo (ayuda a depurar en el inspector); la capa sí se lee en
 * runtime para decidir quién esquiva a quién.
 */
export const floatingObstacle = (
  name: string,
  layer: FloatingLayer = FLOATING_LAYER.edgeBar,
) => ({
  [FLOATING_OBSTACLE_ATTR]: name,
  [FLOATING_LAYER_ATTR]: String(layer),
});

/** Lee la capa de un obstáculo; sin marca explícita cuenta como `edgeBar`. */
export const readFloatingLayer = (element: Element): number => {
  const raw = element.getAttribute(FLOATING_LAYER_ATTR);
  const parsed = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : FLOATING_LAYER.edgeBar;
};

/** Aire mínimo entre un elemento flotante y el que esquiva. */
export const FLOATING_GAP = 12;

/** Cortafuegos del bucle de resolución (obstáculos apilados). */
const MAX_PASSES = 8;

/**
 * Banda medida desde el borde INFERIOR del viewport (mismo sistema de
 * coordenadas que la propiedad CSS `bottom`).
 */
export type FloatingBand = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type FloatingObstacleBand = FloatingBand & { layer: number };

/** Convierte un rect del viewport a una banda medida desde abajo. */
export const toFloatingBand = (
  rect: { top: number; bottom: number; left: number; right: number },
  viewportHeight: number,
): FloatingBand => ({
  top: viewportHeight - rect.top,
  bottom: viewportHeight - rect.bottom,
  left: rect.left,
  right: rect.right,
});

/**
 * Fracción MÍNIMA del ancho propio que un obstáculo tiene que cubrir para
 * obligarnos a subir.
 *
 * Sin este piso alcanzaba 1px de solape, y eso rompía a los elementos de ancho
 * completo: en el home de desdeelsur el aviso de cookies (1440px de ancho)
 * esquivaba al botón "volver arriba" (40px, en la esquina derecha) y terminaba
 * en `bottom: 124px` — flotando en el medio de la página y tapando una card
 * entera del catálogo en TODO el ancho, en vez de quedar pegado al borde
 * (DESDEELSUR-61 / BUG-05).
 *
 * Subir sólo tiene sentido cuando el obstáculo cubre una parte real de lo
 * nuestro: un elemento de ancho completo no tiene ninguna columna libre a la que
 * correrse, así que esquivar un botón lateral no lo destapa — sólo mueve el
 * problema al contenido de abajo. La fracción se mide contra el ancho PROPIO, no
 * contra el del obstáculo: así un botón flotante chico sigue esquivando al nav
 * mobile de ancho completo (lo cubre al 100% de SU ancho), que es el caso para
 * el que se escribió este módulo.
 */
export const MIN_HORIZONTAL_OVERLAP_RATIO = 0.25;

const overlapsHorizontally = (a: FloatingBand, b: FloatingBand): boolean => {
  const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  if (overlap <= 0) return false;

  const selfWidth = a.right - a.left;
  // Un ancho propio no medible (0) no puede dar una fracción: cualquier solape
  // cuenta, que es el comportamiento conservador de siempre.
  if (selfWidth <= 0) return true;

  return overlap / selfWidth >= MIN_HORIZONTAL_OVERLAP_RATIO;
};

const overlapsVertically = (a: FloatingBand, b: FloatingBand): boolean =>
  a.bottom < b.top && b.bottom < a.top;

/**
 * Calcula el `bottom` final de un elemento anclado abajo para que no pise a
 * ninguno de los obstáculos que le corresponde esquivar.
 *
 * Es la parte pura de `useSafeBottomOffset`: se arranca en `baseOffset` y,
 * mientras la banda propia cruce la de un obstáculo que además la solape en
 * horizontal, se sube justo por encima de ese obstáculo. Solo se consideran los
 * obstáculos de capa MENOR a `layer` (ver `FLOATING_LAYER`).
 */
export const resolveFloatingBottomOffset = ({
  self,
  obstacles,
  layer,
  baseOffset,
  viewportHeight,
  gap = FLOATING_GAP,
}: {
  self: { height: number; left: number; right: number };
  obstacles: FloatingObstacleBand[];
  layer: number;
  baseOffset: number;
  viewportHeight: number;
  gap?: number;
}): number => {
  // Los de capa igual o mayor se corren ellos: esquivarlos también sería un
  // empuje mutuo sin punto fijo (los dos treparían hasta el techo).
  const relevant = obstacles.filter((obstacle) => obstacle.layer < layer);

  let next = baseOffset;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const band: FloatingBand = {
      bottom: next,
      top: next + self.height,
      left: self.left,
      right: self.right,
    };
    const blocking = relevant
      .filter(
        (obstacle) =>
          overlapsHorizontally(band, obstacle) && overlapsVertically(band, obstacle),
      )
      .sort((a, b) => b.top - a.top)[0];
    if (!blocking) break;
    next = Math.ceil(blocking.top) + gap;
  }

  // Nunca empujar el elemento fuera de la pantalla: si el borde inferior quedó
  // demasiado alto, lo dejamos en el último lugar donde todavía se ve.
  const maxOffset = Math.max(baseOffset, viewportHeight - self.height - gap);
  return Math.min(next, maxOffset);
};
