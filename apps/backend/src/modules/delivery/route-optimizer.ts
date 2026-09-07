/**
 * route-optimizer (M8) — optimización del ORDEN de paradas de una ruta para
 * minimizar la distancia total recorrida.
 *
 * Función PURA y DETERMINÍSTICA, sin dependencias externas ni solver. La heurística
 * es nearest-neighbor (construcción) + 2-opt (mejora local):
 *
 *  1) Haversine: distancia en km entre dos puntos {lat,lng} sobre la esfera.
 *  2) Nearest-neighbor: arranca en el `origin` (sucursal de salida) y, en cada
 *     paso, salta a la parada NO visitada más cercana al punto actual. Construye
 *     un tour razonable en O(n²).
 *  3) 2-opt: mejora el tour deshaciendo cruces. Recorre todos los pares de aristas
 *     (i, j) y, si invertir el segmento intermedio reduce la distancia total,
 *     aplica la inversión. Repite en pasadas hasta que no haya mejora o se agote
 *     el máximo de pasadas (MAX_2OPT_PASSES) — esto acota el costo y garantiza
 *     determinismo (no hay aleatoriedad: el orden de evaluación es fijo).
 *
 * El origen NO es una parada: es el punto de salida (depósito / sucursal). El tour
 * empieza en él pero el origen NO se devuelve en `ordered` (no es un stop a
 * resecuenciar). NO se modela el regreso al origen (ruta abierta): se optimiza el
 * recorrido de reparto, que termina en la última entrega.
 *
 * Stops SIN coordenadas válidas (lat/lng null, NaN o fuera de rango): NO se pueden
 * optimizar geométricamente, así que se EXCLUYEN del cálculo y se appendean AL
 * FINAL del orden resultante, preservando su orden relativo de entrada. Así la
 * salida siempre contiene TODOS los stops de entrada exactamente una vez (solo
 * reordena, nunca agrega ni quita).
 */

/** Punto geográfico simple. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Parada candidata a optimizar. `lat`/`lng` pueden venir nulas/ inválidas. */
export interface OptimizerStop {
  id: string;
  lat?: number | null;
  lng?: number | null;
}

/** Resultado de la optimización. */
export interface OptimizeStopsResult {
  /** IDs de los stops en el orden óptimo (TODOS los de entrada, 1 vez c/u). */
  ordered: string[];
  /** Distancia total del recorrido optimizado (km, origin → stops en orden). */
  total_distance_km: number;
  /** Distancia total del recorrido ORIGINAL (origin → stops en orden de entrada). */
  original_distance_km: number;
  /** Mejora porcentual: (original - total) / original * 100. 0 si no hay original. */
  improvement_pct: number;
  /** Cantidad de stops con coordenadas válidas que entraron al cálculo. */
  optimized_count: number;
  /** Cantidad de stops SIN coordenadas válidas, appendeados al final sin optimizar. */
  unlocated_count: number;
}

/** Tope de pasadas de 2-opt. Acota el costo y hace el resultado determinístico. */
export const MAX_2OPT_PASSES = 30;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** True si el punto tiene lat/lng finitas y dentro de rango geográfico. */
const isValidPoint = (lat: unknown, lng: unknown): lat is number => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Distancia haversine (km) entre dos puntos sobre la esfera terrestre. Exportada
 * para tests. Determinística y conmutativa.
 */
export const haversineKm = (a: GeoPoint, b: GeoPoint): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
};

/**
 * Largo total de un recorrido ABIERTO origin → points[0] → points[1] → … (no
 * vuelve al origen). points es la secuencia de paradas en el orden a medir.
 */
const tourLength = (origin: GeoPoint, points: GeoPoint[]): number => {
  if (points.length === 0) return 0;
  let total = haversineKm(origin, points[0]!);
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i]!, points[i + 1]!);
  }
  return total;
};

/**
 * Nearest-neighbor: parte del origin y va eligiendo el punto no visitado más
 * cercano al actual. Devuelve los índices (sobre el array de entrada) en el orden
 * construido. Determinístico: ante empate de distancia gana el índice menor
 * (orden de recorrido del for).
 */
const nearestNeighborOrder = (origin: GeoPoint, points: GeoPoint[]): number[] => {
  const n = points.length;
  const visited = new Array<boolean>(n).fill(false);
  const order: number[] = [];
  let current = origin;

  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const d = haversineKm(current, points[i]!);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    visited[best] = true;
    order.push(best);
    current = points[best]!;
  }

  return order;
};

/**
 * Mejora 2-opt sobre un orden inicial (índices). Recorre pares (i, j) e invierte
 * el segmento [i..j] si reduce el largo total del tour ABIERTO desde origin.
 * Repite en pasadas hasta no mejorar o agotar MAX_2OPT_PASSES. Determinístico:
 * orden de evaluación fijo, sin aleatoriedad.
 */
const twoOptOrder = (
  origin: GeoPoint,
  points: GeoPoint[],
  initialOrder: number[],
): number[] => {
  const n = initialOrder.length;
  if (n < 3) return initialOrder.slice();

  let order = initialOrder.slice();
  const lengthOf = (ord: number[]): number =>
    tourLength(
      origin,
      ord.map((idx) => points[idx]!),
    );
  let bestLength = lengthOf(order);

  for (let pass = 0; pass < MAX_2OPT_PASSES; pass++) {
    let improved = false;

    // i desde 0 (la 1ra arista origin→order[0] también puede mejorar invirtiendo
    // desde el principio). j > i. Invertimos order[i..j].
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = order.slice();
        let lo = i;
        let hi = j;
        while (lo < hi) {
          const tmp = candidate[lo]!;
          candidate[lo] = candidate[hi]!;
          candidate[hi] = tmp;
          lo++;
          hi--;
        }
        const candLength = lengthOf(candidate);
        // Mejora estricta con un epsilon para evitar ciclos por ruido de punto
        // flotante (inversiones que dan exactamente la misma distancia).
        if (candLength < bestLength - 1e-9) {
          order = candidate;
          bestLength = candLength;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return order;
};

/**
 * Optimiza el orden de las paradas minimizando la distancia total desde `origin`.
 *
 * - Separa stops con coords válidas (located) de los inválidos (unlocated).
 * - Sobre los located corre nearest-neighbor + 2-opt.
 * - Appendea los unlocated al final, en su orden relativo de entrada.
 * - Calcula la distancia original (orden de entrada de los located) y la
 *   optimizada para reportar la mejora porcentual.
 *
 * Determinístico: misma entrada → misma salida. No usa Math.random ni Date.
 */
export const optimizeStops = (
  origin: GeoPoint,
  stops: OptimizerStop[],
): OptimizeStopsResult => {
  const located: { id: string; point: GeoPoint }[] = [];
  const unlocated: string[] = [];

  for (const stop of stops) {
    if (isValidPoint(stop.lat, stop.lng)) {
      located.push({ id: stop.id, point: { lat: stop.lat, lng: stop.lng as number } });
    } else {
      unlocated.push(stop.id);
    }
  }

  // Sin located (0 o 1) no hay nada que optimizar: el orden de entrada ya es óptimo.
  if (located.length <= 1) {
    const orderedLocated = located.map((l) => l.id);
    const dist = tourLength(
      origin,
      located.map((l) => l.point),
    );
    return {
      ordered: [...orderedLocated, ...unlocated],
      total_distance_km: round(dist),
      original_distance_km: round(dist),
      improvement_pct: 0,
      optimized_count: located.length,
      unlocated_count: unlocated.length,
    };
  }

  const points = located.map((l) => l.point);

  // Distancia del recorrido ORIGINAL (orden de entrada de los located).
  const originalDistance = tourLength(origin, points);

  // Construcción + mejora.
  const nnOrder = nearestNeighborOrder(origin, points);
  const optimizedOrder = twoOptOrder(origin, points, nnOrder);

  const optimizedDistance = tourLength(
    origin,
    optimizedOrder.map((idx) => points[idx]!),
  );

  // Si la "optimización" no mejoró (o empeoró por algún caso degenerado), nos
  // quedamos con el orden ORIGINAL: nunca devolvemos algo peor que la entrada.
  const useOptimized = optimizedDistance < originalDistance - 1e-9;
  const finalOrder = useOptimized
    ? optimizedOrder.map((idx) => located[idx]!.id)
    : located.map((l) => l.id);
  const finalDistance = useOptimized ? optimizedDistance : originalDistance;

  const improvementPct =
    originalDistance > 0
      ? ((originalDistance - finalDistance) / originalDistance) * 100
      : 0;

  return {
    ordered: [...finalOrder, ...unlocated],
    total_distance_km: round(finalDistance),
    original_distance_km: round(originalDistance),
    improvement_pct: round(Math.max(0, improvementPct), 2),
    optimized_count: located.length,
    unlocated_count: unlocated.length,
  };
};

/** Redondeo determinístico a `digits` decimales (default 3 → metros). */
const round = (n: number, digits = 3): number => {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
};
