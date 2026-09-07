import type { PolygonPoint } from '../../../../modules/store-location/coverage/types';

/**
 * Extracción de TODAS las áreas de cobertura de un GeoJSON.
 *
 * ─── Por qué existe ─────────────────────────────────────────────────────────
 *
 * Hasta acá el picker tenía un `extractFirstRing`: se quedaba con la PRIMERA
 * geometría del archivo y descartaba el resto sin un solo warning. Un archivo
 * multi-área —un `MultiPolygon` con 21 polígonos, uno por localidad— entraba
 * como un único polígono, el #0. Las cuatro sucursales de Bariloche quedaron
 * con el polígono de Junín de los Andes, a 130 km, y las cuatro con el MISMO
 * polígono. El bug no era el parseo: era el SILENCIO.
 *
 * De ahí la regla que gobierna este módulo:
 *
 *   TODO lo que el archivo trae y la importación no usa —una geometría, un
 *   agujero, un nombre que hubo que recortar, una property— sale en el
 *   resultado para que la UI lo diga. Nada se cae callado.
 *
 * ─── El contrato: un área = UNA fila de `branch_coverage` ────────────────────
 *
 * `coverage/polygon-engine.ts` evalúa UNA lista de vértices por fila, así que
 * ni los agujeros (anillos interiores) ni las multi-geometrías caben en una
 * fila. Partirlas en N filas no necesita migración —nada limita a una fila por
 * sucursal— y regala nombre, prioridad y activación POR ÁREA, porque
 * `service.resolveByPoint` ya itera sobre todas las coberturas activas.
 *
 * ─── El orden de las coordenadas ────────────────────────────────────────────
 *
 * GeoJSON es `[longitud, latitud]`. El storage es `{ x: lng, y: lat }` y como
 * STRING. Es la trampa que ya documentó el equipo: invertirlo no rompe nada
 * visible, sólo manda el polígono al otro hemisferio.
 */

/** Un área lista para convertirse en una fila de cobertura. */
export interface GeoJsonArea {
  /**
   * Nombre que trae el archivo, sanitizado. Cuando el archivo no nombra las
   * áreas queda `undefined` a propósito: numerarlas es texto de UI y va por
   * i18n, no acá.
   */
  name?: string;
  /**
   * `properties.active` del archivo, cuando lo trae. Es la ÚNICA property que
   * se importa además del nombre: el modelo tiene el mismo campo con la misma
   * semántica (`false` = la cobertura no participa de la resolución).
   */
  active?: boolean;
  /** Anillo exterior en orden GeoJSON: `[lng, lat][]`. */
  ring: number[][];
}

/** Por qué un área no pudo usarse. */
export type DiscardReason =
  /** Menos de 3 vértices distintos: no es un polígono. */
  | 'too_few_points'
  /** `NaN`, `Infinity` o algo que no es número. */
  | 'non_finite'
  /** Fuera de `lng` -180..180 / `lat` -90..90. */
  | 'out_of_range'
  /** El anillo no es una lista de posiciones `[lng, lat]`. */
  | 'malformed_ring';

export interface DiscardedArea {
  /** Nombre del archivo, o `#<n>` (1-based) cuando el archivo no lo nombra. */
  label: string;
  reason: DiscardReason;
  /** El dato concreto: cantidad de vértices, o la coordenada culpable. */
  detail?: string;
}

/** Fallas que dejan el archivo sin NADA usable. */
export type ExtractionError =
  /** No es un objeto GeoJSON. */
  | 'not_geojson'
  /** Es GeoJSON válido pero no hay ningún Polygon/MultiPolygon adentro. */
  | 'no_polygon';

/** Por qué un nombre del archivo no llegó tal cual a la fila. */
export type NameAdjustment =
  /** Dos áreas pedían el mismo nombre: se desambiguó con sufijo. */
  | 'duplicate'
  /** El nombre superaba `MAX_NAME_LENGTH` y se recortó. */
  | 'truncated';

export interface AdjustedName {
  /** El nombre tal cual lo trae el archivo. */
  from: string;
  /** El primer nombre final que se generó a partir de él. */
  to: string;
  reason: NameAdjustment;
  /**
   * Cuántas áreas quedaron afectadas por este mismo ajuste. Se agrupa por
   * nombre de origen: el archivo viejo tiene UNA feature con 21 polígonos, y
   * listar 21 veces la misma línea es un muro que nadie lee.
   */
  count: number;
}

export interface GeoJsonAreasResult {
  /** Las áreas usables, en el orden del archivo. */
  areas: GeoJsonArea[];
  /**
   * Anillos interiores (agujeros) que se ignoraron. El motor no los soporta:
   * se usa el exterior. Nunca en silencio — este número va a la UI.
   */
  ignoredHoles: number;
  /** Áreas que no pasaron la validación, con el motivo. */
  discarded: DiscardedArea[];
  /** Tipos de geometría que no son Polygon/MultiPolygon y se saltearon. */
  unsupported: string[];
  /**
   * Nombres que hubo que tocar (duplicados desambiguados, largos recortados).
   * Renombrar en silencio es la misma clase de bug que descartar en silencio:
   * el operador cree que subió "Bariloche" y en la tabla hay otra cosa.
   */
  adjustedNames: AdjustedName[];
  /**
   * TODA property que el archivo declara en sus features y que la importación
   * no usa, ordenada alfabéticamente. Es la lista que la UI muestra: metadata
   * que se cae en silencio es metadata que el operador cree que se aplicó.
   *
   * Sólo quedan afuera de esta lista las dos que SÍ se importan: la clave del
   * nombre que matcheó y `active`.
   */
  ignoredProperties: string[];
  /** Cuántas áreas traían `active` en el archivo (el resto usa el default del panel). */
  activeFromFile: number;
  /** Sólo cuando no quedó nada usable Y tampoco hay descartes que lo expliquen. */
  error?: ExtractionError;
}

/**
 * Tope de anidamiento para `FeatureCollection` / `GeometryCollection`. GeoJSON
 * permite colecciones anidadas y un archivo hostil podría anidarlas hasta
 * colgar el navegador.
 */
const MAX_NESTING = 8;

/** Claves de nombre que se aceptan, en orden de preferencia. */
const NAME_KEYS = ['name', 'nombre', 'localidad'] as const;

/**
 * Tope de largo del nombre de una cobertura. La columna es TEXT, así que esto
 * no es un límite del motor: es para que la fila siga siendo legible en la
 * tabla y para que un `properties.name` con una descripción entera no termine
 * siendo el nombre de una zona. Las tildes y la ñ se preservan: son parte del
 * nombre real de la localidad ("Junín", "Añelo", "Picún Leufú").
 */
export const MAX_NAME_LENGTH = 120;

const LNG_LIMIT = 180;
const LAT_LIMIT = 90;

/**
 * Normaliza un nombre del archivo: colapsa los espacios internos (incluidos
 * saltos de línea y tabs, que un export puede traer) y recorta los extremos.
 * Devuelve `undefined` si no queda nada — un nombre vacío no puede llegar a la
 * fila.
 */
const sanitizeName = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed || undefined;
};

/** El nombre que declara una feature y con qué clave lo declaró. */
const readName = (properties: unknown): { name: string; key: string } | undefined => {
  if (!properties || typeof properties !== 'object') return undefined;
  const bag = properties as Record<string, unknown>;
  for (const key of NAME_KEYS) {
    const name = sanitizeName(bag[key]);
    if (name) return { name, key };
  }
  return undefined;
};

/**
 * Vértices reales del anillo: si viene cerrado (primer punto == último), el
 * duplicado de cierre no cuenta. Un triángulo cerrado son 4 posiciones y 3
 * vértices.
 *
 * Se exporta porque `simplify-ring.ts` cuenta lo mismo y "cuántos vértices
 * tiene este anillo" tiene que tener UN solo dueño: si los dos módulos cuentan
 * distinto, el "antes → después" que ve el operador no cierra con el resumen
 * del archivo.
 */
export const openLength = (ring: number[][]): number => {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length >= 2 && first && last && first[0] === last[0] && first[1] === last[1]) {
    return ring.length - 1;
  }
  return ring.length;
};

type RingCheck = { ring: number[][] } | { reason: DiscardReason; detail?: string };

/** Valida un anillo crudo y lo normaliza a `[lng, lat][]` (descarta la altitud). */
const checkRing = (raw: unknown): RingCheck => {
  if (!Array.isArray(raw) || !raw.length) return { reason: 'malformed_ring' };

  const ring: number[][] = [];
  for (const position of raw) {
    if (!Array.isArray(position) || position.length < 2) {
      return { reason: 'malformed_ring' };
    }
    const lng = position[0];
    const lat = position[1];
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { reason: 'non_finite', detail: `${String(lng)}, ${String(lat)}` };
    }
    if (Math.abs(lng) > LNG_LIMIT || Math.abs(lat) > LAT_LIMIT) {
      return { reason: 'out_of_range', detail: `${lng}, ${lat}` };
    }
    // La altitud (3er elemento) se tira: el motor es 2D.
    ring.push([lng, lat]);
  }

  const vertices = openLength(ring);
  if (vertices < 3) return { reason: 'too_few_points', detail: String(vertices) };
  return { ring };
};

/** Un polígono encontrado en el árbol: `rings[0]` es el exterior, el resto agujeros. */
interface Candidate {
  name?: string;
  active?: boolean;
  rings: unknown[];
}

/** Lo que se va juntando mientras se recorre el árbol. */
interface Walk {
  candidates: Candidate[];
  unsupported: string[];
  /** Union de las claves de `properties` vistas en las features. */
  declared: Set<string>;
  /** Las claves que la importación SÍ consume (la del nombre y `active`). */
  consumed: Set<string>;
}

/**
 * Recorre el árbol GeoJSON juntando TODOS los polígonos. Acepta
 * `FeatureCollection`, `Feature`, `GeometryCollection` y geometría desnuda; el
 * nombre y el `active` de la feature se heredan hacia abajo (una feature con
 * `MultiPolygon` aporta N áreas y las N comparten su metadata).
 */
const collectCandidates = (
  node: unknown,
  inherited: { name?: string; active?: boolean },
  walk: Walk,
  depth: number,
): void => {
  if (!node || typeof node !== 'object' || depth > MAX_NESTING) return;
  const value = node as Record<string, unknown>;
  const type = typeof value.type === 'string' ? value.type : null;

  if (type === 'FeatureCollection') {
    const features = Array.isArray(value.features) ? value.features : [];
    for (const feature of features) collectCandidates(feature, inherited, walk, depth + 1);
    return;
  }

  if (type === 'Feature') {
    const properties = value.properties;
    if (properties && typeof properties === 'object') {
      for (const key of Object.keys(properties as Record<string, unknown>)) walk.declared.add(key);
    }
    const named = readName(properties);
    if (named) walk.consumed.add(named.key);

    // `active` es la única property además del nombre que se importa: el modelo
    // tiene el mismo campo y la misma semántica.
    const rawActive = (properties as Record<string, unknown> | null | undefined)?.active;
    const active = typeof rawActive === 'boolean' ? rawActive : undefined;
    if (active !== undefined) walk.consumed.add('active');

    collectCandidates(
      value.geometry,
      { name: named?.name ?? inherited.name, active: active ?? inherited.active },
      walk,
      depth + 1,
    );
    return;
  }

  if (type === 'GeometryCollection') {
    const geometries = Array.isArray(value.geometries) ? value.geometries : [];
    for (const geometry of geometries) collectCandidates(geometry, inherited, walk, depth + 1);
    return;
  }

  if (type === 'Polygon') {
    const coordinates = Array.isArray(value.coordinates) ? value.coordinates : [];
    walk.candidates.push({ ...inherited, rings: coordinates });
    return;
  }

  if (type === 'MultiPolygon') {
    const polygons = Array.isArray(value.coordinates) ? value.coordinates : [];
    for (const polygon of polygons) {
      walk.candidates.push({ ...inherited, rings: Array.isArray(polygon) ? polygon : [] });
    }
    return;
  }

  // Point, LineString, lo que sea: se saltea, pero se DICE.
  if (type) walk.unsupported.push(type);
};

interface LabeledCandidate extends Candidate {
  /** Cómo se lo nombra en los mensajes (siempre presente, aun sin nombre). */
  label: string;
}

/**
 * Resuelve el nombre final de cada área y anota lo que hubo que tocar.
 *
 * Desambigua los repetidos con sufijo numérico, y cubre los dos casos: una
 * feature que aporta N áreas (el archivo viejo: 1 feature, 21 polígonos) y N
 * features distintas que piden el mismo nombre. El índice se calcula ANTES de
 * validar, así el descarte del área 3 no renumera a la 4 — el número sigue
 * siendo la posición en el archivo.
 *
 * El recorte por largo se aplica a la BASE, no al resultado: si primero se
 * agregara el sufijo, recortar se lo comería y dos áreas volverían a colisionar.
 */
const labelCandidates = (
  candidates: Candidate[],
  adjustedNames: AdjustedName[],
): LabeledCandidate[] => {
  const totals = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.name) totals.set(candidate.name, (totals.get(candidate.name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return candidates.map((candidate, index) => {
    const base = candidate.name;
    if (!base) return { label: `#${index + 1}`, active: candidate.active, rings: candidate.rings };

    const duplicated = (totals.get(base) ?? 1) > 1;
    let suffix = '';
    if (duplicated) {
      const ordinal = (seen.get(base) ?? 0) + 1;
      seen.set(base, ordinal);
      suffix = ` ${ordinal}`;
    }

    const room = MAX_NAME_LENGTH - suffix.length;
    const trimmedBase = base.length > room ? base.slice(0, room).trimEnd() : base;
    const name = `${trimmedBase}${suffix}`;

    const reason: NameAdjustment | null =
      trimmedBase !== base ? 'truncated' : duplicated ? 'duplicate' : null;
    if (reason) {
      // Se agrupa por (origen, motivo): una feature con 21 polígonos genera 21
      // ajustes idénticos y se reportan como una línea con su conteo.
      const existing = adjustedNames.find((a) => a.from === base && a.reason === reason);
      if (existing) existing.count++;
      else adjustedNames.push({ from: base, to: name, reason, count: 1 });
    }

    return { label: name, name, active: candidate.active, rings: candidate.rings };
  });
};

/**
 * Todas las áreas de un valor GeoJSON, más el detalle de lo que se ignoró.
 * Función pura: no toca red, ni DOM, ni i18n.
 */
export const extractGeoJsonAreas = (geojson: unknown): GeoJsonAreasResult => {
  if (!geojson || typeof geojson !== 'object') {
    return {
      areas: [],
      ignoredHoles: 0,
      discarded: [],
      unsupported: [],
      adjustedNames: [],
      ignoredProperties: [],
      activeFromFile: 0,
      error: 'not_geojson',
    };
  }

  const walk: Walk = {
    candidates: [],
    unsupported: [],
    declared: new Set(),
    consumed: new Set(),
  };
  collectCandidates(geojson, {}, walk, 0);

  const areas: GeoJsonArea[] = [];
  const discarded: DiscardedArea[] = [];
  const adjustedNames: AdjustedName[] = [];
  let ignoredHoles = 0;
  let activeFromFile = 0;

  for (const candidate of labelCandidates(walk.candidates, adjustedNames)) {
    const checked = checkRing(candidate.rings[0]);
    if ('reason' in checked) {
      discarded.push({ label: candidate.label, reason: checked.reason, detail: checked.detail });
      continue;
    }
    // Los agujeros se cuentan sólo del área que SÍ entra: si el área se
    // descarta entera, sus anillos interiores no son "un agujero ignorado".
    ignoredHoles += Math.max(0, candidate.rings.length - 1);

    const area: GeoJsonArea = { ring: checked.ring };
    if (candidate.name) area.name = candidate.name;
    if (candidate.active !== undefined) {
      area.active = candidate.active;
      activeFromFile++;
    }
    areas.push(area);
  }

  const result: GeoJsonAreasResult = {
    areas,
    ignoredHoles,
    discarded,
    unsupported: walk.unsupported,
    adjustedNames,
    // La regla: toda property declarada que no se consuma, se reporta.
    ignoredProperties: [...walk.declared].filter((key) => !walk.consumed.has(key)).sort(),
    activeFromFile,
  };
  // `error` sólo cuando no hay nada usable Y no hay descartes que lo expliquen:
  // si hubo descartes, el motivo ya está dicho, uno por área.
  if (!areas.length && !discarded.length) result.error = 'no_polygon';
  return result;
};

/**
 * Un anillo GeoJSON (`[lng, lat][]`) → los vértices que guarda el módulo
 * (`{ x: lng, y: lat }` como string), cerrados para que el ray-casting evalúe
 * también la última arista.
 */
export const ringToPolygonPoints = (ring: number[][]): PolygonPoint[] => {
  const points: PolygonPoint[] = ring
    .filter((c) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => ({ x: String(c[0]), y: String(c[1]) }));

  const first = points[0];
  const last = points[points.length - 1];
  if (points.length >= 3 && first && last && (first.x !== last.x || first.y !== last.y)) {
    points.push({ x: first.x, y: first.y });
  }
  return points;
};

/** Total de vértices de un conjunto de áreas (para el resumen que ve el operador). */
export const countVertices = (areas: GeoJsonArea[]): number =>
  areas.reduce((total, area) => total + openLength(area.ring), 0);
