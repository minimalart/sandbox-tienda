import { openLength, type GeoJsonArea } from './geojson-areas';

/**
 * Simplificación de anillos con Ramer–Douglas–Peucker, con la tolerancia en
 * METROS.
 *
 * ─── Por qué existe ─────────────────────────────────────────────────────────
 *
 * El archivo real que se importa son los límites urbanos de OpenStreetMap: 21
 * localidades, 16.713 vértices, 1,4 MB. Bariloche sola trae 6180 vértices para
 * una mancha de 38 × 19 km — resolución de un metro, dos órdenes de magnitud
 * más de lo que hace falta para contestar "¿esta dirección está adentro?".
 *
 * Y eso no se paga una vez al importar: `store-location/service.ts`
 * (`resolveByPoint`) hace `listBranchCoverages({ active: true })` y deserializa
 * TODAS las coberturas activas en memoria en cada `GET /store/shipping-options`,
 * en cada guardado de dirección y en cada login. Con estas 21 zonas en las 4
 * sucursales son 84 filas y ~5,6 MB de JSONB por request. Ese es el costo que
 * este módulo baja, y por eso la simplificación va en la IMPORTACIÓN: el dato
 * entra ya del tamaño correcto y ninguna lectura tiene que hacer nada especial.
 *
 * ─── La tolerancia es en METROS, los datos vienen en GRADOS ─────────────────
 *
 * Correr RDP sobre grados crudos es el error clásico: a latitud −41, un grado
 * de longitud son ~84 km y uno de latitud ~111 km. Una misma tolerancia en
 * grados deforma un 32 % más en el eje X que en el Y, y además el número no
 * significa nada para quien lo elige en la UI.
 *
 * Así que el anillo se proyecta a un plano local métrico (equirectangular
 * alrededor de su propio centroide), RDP corre AHÍ, y los puntos que sobreviven
 * se toman del anillo ORIGINAL en grados — nunca se desproyecta, para no meter
 * un error de ida y vuelta gratis en coordenadas que después se guardan como
 * string.
 *
 * ─── Qué garantiza la tolerancia ────────────────────────────────────────────
 *
 * Es la COTA SUPERIOR del desplazamiento del borde: con 25 m, todo vértice
 * descartado queda a menos de 25 m del borde simplificado. En criollo: **un
 * punto que esté a menos de 25 m del límite puede cambiar de lado**. Para un
 * límite urbano de OSM —que ya es una convención administrativa, no una línea
 * física— eso es ruido; para una zona de reparto trazada a mano con precisión
 * de cuadra, no. Por eso el "sin simplificar" existe y el número se elige.
 *
 * RDP sólo DESCARTA vértices: nunca promedia, nunca inventa un punto que no
 * estuviera en el archivo.
 */

/**
 * Piso duro: un anillo válido necesita 4 posiciones (3 vértices distintos + el
 * cierre). Si la simplificación lo dejaría por debajo, se devuelve el anillo
 * ORIGINAL sin tocar y se reporta — un "área" de dos puntos no es un polígono,
 * es un segmento, y el ray-casting de `coverage/polygon-engine.ts` no
 * contendría jamás a nadie. Callarlo sería crear una zona que no cubre nada.
 */
export const MIN_RING_POSITIONS = 4;

/** El piso expresado en vértices (sin contar el punto de cierre). */
const MIN_RING_VERTICES = MIN_RING_POSITIONS - 1;

/**
 * Las opciones del selector, en metros. `0` = no simplificar.
 *
 * No son arbitrarias: 10 m es "casi el archivo original" (sirve para trazados a
 * mano), 25 m es el default porque sobre límites de OSM saca la mayor parte de
 * los vértices sin mover el borde de forma perceptible, y 50/100 m son para
 * zonas grandes donde el borde ya es una aproximación.
 */
export const SIMPLIFY_TOLERANCES_M = [0, 10, 25, 50, 100] as const;

/** Default del selector. Ver el comentario de arriba. */
export const DEFAULT_SIMPLIFY_TOLERANCE_M = 25;

/** Metros por grado de latitud. Radio medio terrestre; el error es < 0,5 %. */
const METERS_PER_DEGREE = 111320;

const DEG_TO_RAD = Math.PI / 180;

/** Un punto ya proyectado al plano local, en metros. */
interface PlanePoint {
  x: number;
  y: number;
}

/** El resultado de simplificar UN anillo. */
export interface RingSimplification {
  /** El anillo resultante. Si no se pudo simplificar, es el original por identidad. */
  ring: number[][];
  /** Vértices antes (sin contar el cierre). */
  before: number;
  /** Vértices después (sin contar el cierre). */
  after: number;
  /**
   * `true` cuando el piso de {@link MIN_RING_POSITIONS} impidió simplificar y se
   * devolvió el original. NO es lo mismo que `after === before`: un anillo puede
   * quedar igual simplemente porque ningún vértice sobraba.
   */
  floored: boolean;
}

/**
 * Proyecta el anillo a un plano local en metros, centrado en su centroide.
 *
 * El centroide sólo mueve el origen —no cambia ninguna distancia— pero mantiene
 * las coordenadas chicas y bien condicionadas. Lo que importa es `scaleX`: el
 * factor `cos(lat0)` es lo que hace que un metro en X valga lo mismo que un
 * metro en Y.
 */
const projectRing = (ring: number[][]): PlanePoint[] => {
  let sumLng = 0;
  let sumLat = 0;
  for (const position of ring) {
    sumLng += position[0];
    sumLat += position[1];
  }
  const lng0 = sumLng / ring.length;
  const lat0 = sumLat / ring.length;
  const scaleX = METERS_PER_DEGREE * Math.cos(lat0 * DEG_TO_RAD);

  return ring.map((position) => ({
    x: (position[0] - lng0) * scaleX,
    y: (position[1] - lat0) * METERS_PER_DEGREE,
  }));
};

/**
 * Distancia² del punto `p` al SEGMENTO `a`–`b` (no a la recta infinita).
 *
 * Contra el segmento y no contra la recta a propósito: es la variante
 * conservadora. Medir contra la recta infinita subestima la distancia de los
 * puntos que caen más allá de los extremos, y esos son justo los que forman las
 * penínsulas y los recovecos de un límite urbano.
 */
const segmentDistanceSq = (p: PlanePoint, a: PlanePoint, b: PlanePoint): number => {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
};

/**
 * Ramer–Douglas–Peucker sobre una secuencia ABIERTA. Devuelve la máscara de
 * cuáles sobreviven (por índice), no los puntos: el que llama mapea contra el
 * array original y así los grados nunca pasan por el plano.
 *
 * La pila es explícita en vez de recursión: un anillo de 6180 vértices en el
 * peor caso (una espiral) degeneraría en 6180 marcos de pila.
 */
const douglasPeucker = (points: PlanePoint[], toleranceMeters: number): boolean[] => {
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const toleranceSq = toleranceMeters * toleranceMeters;
  const stack: [number, number][] = [[0, points.length - 1]];

  while (stack.length) {
    const segment = stack.pop();
    if (!segment) break;
    const [first, last] = segment;

    let index = -1;
    // Arranca en la tolerancia: sólo parte el tramo si alguno la SUPERA.
    let maxSq = toleranceSq;
    for (let i = first + 1; i < last; i++) {
      const distanceSq = segmentDistanceSq(points[i], points[first], points[last]);
      if (distanceSq > maxSq) {
        maxSq = distanceSq;
        index = i;
      }
    }

    if (index === -1) continue;
    keep[index] = true;
    stack.push([first, index], [index, last]);
  }

  return keep;
};

/** ¿El anillo trae el punto de cierre duplicado al final? */
const isClosed = (ring: number[][]): boolean => openLength(ring) === ring.length - 1;

/**
 * Simplifica UN anillo `[lng, lat][]` con una tolerancia en metros.
 *
 * Función pura: devuelve un anillo nuevo o el mismo por identidad, y nunca
 * muta la entrada. Con `toleranceMeters <= 0` (o no finito) no hace nada — es
 * la opción "sin simplificar" del selector.
 *
 * Un anillo cerrado sale cerrado: RDP corre sobre la secuencia SIN el punto de
 * cierre —si no, el primero y el último serían el mismo punto y el algoritmo no
 * tendría cuerda de referencia— y después se vuelve a cerrar con el primero.
 */
export const simplifyRing = (ring: number[][], toleranceMeters: number): RingSimplification => {
  const before = openLength(ring);
  const untouched: RingSimplification = { ring, before, after: before, floored: false };

  if (!Number.isFinite(toleranceMeters) || toleranceMeters <= 0) return untouched;
  if (ring.length < 2) return untouched;

  const closed = isClosed(ring);
  const open = closed ? ring.slice(0, -1) : ring;

  // Ya está en el piso o por debajo: no hay nada que sacar sin romperlo.
  if (open.length <= MIN_RING_VERTICES) {
    return { ring, before, after: before, floored: true };
  }

  const keep = douglasPeucker(projectRing(open), toleranceMeters);
  // Se mapean los puntos ORIGINALES en grados que sobrevivieron, no los
  // proyectados: desproyectar metería error de ida y vuelta sin ninguna razón.
  const survivors = open.filter((_, index) => keep[index]);

  // El piso manda sobre la tolerancia: antes que devolver un "polígono" de dos
  // puntos, se devuelve el original entero y se dice.
  if (survivors.length < MIN_RING_VERTICES) {
    return { ring, before, after: before, floored: true };
  }
  if (survivors.length === open.length) return untouched;

  const simplified = closed ? [...survivors, survivors[0]] : survivors;
  return { ring: simplified, before, after: survivors.length, floored: false };
};

/** Lo que pasó con UN área, para la tabla de detalle que ve el operador. */
export interface AreaSimplification {
  /** Posición del área en el resultado de extracción (para poder rotularla). */
  index: number;
  /** El nombre del archivo, si lo trae. */
  name?: string;
  before: number;
  after: number;
  /** El piso de {@link MIN_RING_POSITIONS} impidió simplificarla. */
  floored: boolean;
}

export interface AreasSimplification {
  /** Las áreas con el anillo ya simplificado, en el MISMO orden que entraron. */
  areas: GeoJsonArea[];
  /** Una fila por área, para el detalle desplegable. */
  detail: AreaSimplification[];
  /** Vértices totales antes. */
  before: number;
  /** Vértices totales después. */
  after: number;
  /** Cuántas áreas quedaron intactas por el piso. */
  flooredCount: number;
  /** `true` si alguna área perdió vértices. */
  changed: boolean;
}

/**
 * Simplifica todas las áreas de una importación.
 *
 * Devuelve SIEMPRE el antes y el después —total y por área— porque la regla que
 * gobierna este flujo desde el bug del `extractFirstRing` es la misma: nada se
 * modifica en silencio. Acá el dato que entra a la base ya no es el del archivo,
 * y el operador tiene que poder verlo antes de apretar el botón.
 */
export const simplifyAreas = (
  areas: GeoJsonArea[],
  toleranceMeters: number,
): AreasSimplification => {
  const out: GeoJsonArea[] = [];
  const detail: AreaSimplification[] = [];
  let before = 0;
  let after = 0;
  let flooredCount = 0;

  areas.forEach((area, index) => {
    const result = simplifyRing(area.ring, toleranceMeters);
    before += result.before;
    after += result.after;
    if (result.floored) flooredCount++;

    const row: AreaSimplification = {
      index,
      before: result.before,
      after: result.after,
      floored: result.floored,
    };
    if (area.name) row.name = area.name;
    detail.push(row);

    out.push(result.ring === area.ring ? area : { ...area, ring: result.ring });
  });

  return { areas: out, detail, before, after, flooredCount, changed: after < before };
};

/**
 * El porcentaje de vértices que se sacaron, redondeado. Vive acá y no en el
 * componente para que el número que se muestra esté testeado y no divida por
 * cero cuando el archivo viene vacío.
 */
export const reductionPercent = (before: number, after: number): number =>
  before > 0 ? Math.round(((before - after) / before) * 100) : 0;
