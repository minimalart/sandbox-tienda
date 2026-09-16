/**
 * Dónde cae un paso nuevo en el canvas.
 *
 * Es matemática de viewport y de grafo, sin React ni React Flow: así se puede
 * probar que un paso agregado desde la biblioteca no nace tapado por otro ni fuera
 * de la pantalla, que es justo lo que no se puede afirmar mirando un componente.
 */

export type XY = { x: number; y: number };

/** Ancho de la tarjeta. Vive acá porque la usan la ubicación Y el proyector. */
export const CARD_WIDTH = 240;

/** Alto estimado de una tarjeta, sólo para separar lo que se agrega. */
export const CARD_HEIGHT = 96;

export type Viewport = { x: number; y: number; zoom: number };
export type Size = { width: number; height: number };

/**
 * El centro del viewport, en coordenadas del grafo, corrido media tarjeta para que
 * el paso nuevo quede CENTRADO en lo que el operador está mirando y no con su
 * esquina superior izquierda en el medio.
 *
 * Es la traducción que hace `screenToFlowPosition` de React Flow, pero sin el
 * componente: `flow = (pantalla - pan) / zoom`.
 */
export function viewportCenterPosition(viewport: Viewport, size: Size): XY {
  const zoom = viewport.zoom || 1;
  return {
    x: Math.round((size.width / 2 - viewport.x) / zoom - CARD_WIDTH / 2),
    y: Math.round((size.height / 2 - viewport.y) / zoom - CARD_HEIGHT / 2),
  };
}

/** El punto medio entre dos nodos: donde cae un paso insertado en una flecha. */
export function midpoint(a: XY, b: XY): XY {
  return { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
}

/** Justo debajo de un nodo: donde cae un paso colgado de un conector suelto. */
export function below(origin: XY, gap = 140): XY {
  return { x: origin.x, y: origin.y + gap };
}

/**
 * Corre la posición en diagonal hasta encontrar un lugar libre.
 *
 * Sin esto, agregar dos pasos seguidos desde el mismo conector —o soltar uno encima
 * de otro— deja una tarjeta perfectamente tapada por la anterior: el operador ve
 * una sola y no entiende por qué el recorrido tiene un paso de más.
 */
export function nudgeFree(
  position: XY,
  taken: ReadonlyArray<XY | undefined>,
  step = 36,
  limit = 40,
): XY {
  const ocupado = (p: XY): boolean =>
    taken.some((t) => t && Math.abs(t.x - p.x) < step && Math.abs(t.y - p.y) < step);

  let candidate = position;
  for (let i = 0; i < limit && ocupado(candidate); i++) {
    candidate = { x: candidate.x + step, y: candidate.y + step };
  }
  return candidate;
}
