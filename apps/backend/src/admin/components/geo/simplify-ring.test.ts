import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIMPLIFY_TOLERANCE_M,
  MIN_RING_POSITIONS,
  reductionPercent,
  simplifyAreas,
  simplifyRing,
  SIMPLIFY_TOLERANCES_M,
} from './simplify-ring.ts';

/**
 * LO QUE ESTE TEST FIJA.
 *
 * El archivo real de importación son los límites urbanos de OSM: 21 localidades
 * (26 áreas, porque Neuquén Capital es un MultiPolygon de 6), 16.687 vértices,
 * 1,4 MB. Bariloche sola trae 6179 vértices para 38 × 19 km — un vértice por
 * metro. Y `store-location/service.ts` los deserializa TODOS en cada
 * `GET /store/shipping-options`.
 *
 * Simplificar es fácil de hacer mal, y las tres formas de hacerlo mal son las
 * que se testean acá:
 *
 *   1. Correr RDP sobre GRADOS. A latitud −41 un grado de longitud son ~84 km y
 *      uno de latitud ~111 km: la misma tolerancia deforma un 32 % distinto en
 *      cada eje. El test de anisotropía elige a propósito un desvío donde una
 *      implementación en grados contesta distinto según la dirección.
 *   2. Romper el anillo. Dejarlo abierto, o dejarlo con menos de tres vértices
 *      distintos: el ray-casting de `polygon-engine.ts` devuelve 'outside' para
 *      todo y la zona queda viva pero sin cubrir a nadie.
 *   3. Mover los puntos. RDP DESCARTA, no promedia; y los que sobreviven tienen
 *      que salir con los dígitos del archivo, no reproyectados de vuelta.
 *
 * Los dos anillos "reales" son recortes textuales del archivo de producción:
 * Maquinchao entero (5 posiciones) y una tajada contigua de 150 posiciones del
 * borde de Bariloche. No se lee el archivo del disco a propósito: 1,4 MB fuera
 * del repo, en una ruta de un tmp, es un test que se rompe en CI el primer día.
 */

// ── Fixtures ────────────────────────────────────────────────────────────────

/**
 * Maquinchao, tal cual sale del archivo: 5 posiciones, o sea 4 vértices
 * distintos más el cierre. Casi un rectángulo de ~2,3 × 2,2 km. Es el caso que
 * el piso tiene que proteger.
 */
const MAQUINCHAO: number[][] = [
  [-68.7176549, -41.2481808],
  [-68.7011195, -41.2592681],
  [-68.6898725, -41.2500568],
  [-68.6976188, -41.239388],
  [-68.7176549, -41.2481808],
];

/**
 * Tajada contigua de 150 posiciones del borde de Bariloche (las primeras 150,
 * cerradas sobre sí mismas). Geometría y densidad reales de OSM: hay tramos con
 * pasos de menos de un metro entre vértice y vértice.
 */
const BARILOCHE_SLICE: number[][] = [
  [-71.5881237, -41.0780743], [-71.5876329, -41.07851], [-71.5702227, -41.0922927], [-71.5603529, -41.0989541],
  [-71.5610791, -41.1027357], [-71.54996, -41.1040262], [-71.5528124, -41.107752], [-71.5404203, -41.1122026],
  [-71.5387764, -41.1128831], [-71.5349945, -41.1078762], [-71.514371, -41.1168619], [-71.5195772, -41.1394918],
  [-71.4712975, -41.1432893], [-71.460743, -41.1441154], [-71.450721, -41.1442115], [-71.4570298, -41.152004],
  [-71.4653151, -41.1549445], [-71.4680815, -41.1562738], [-71.4729202, -41.1563102], [-71.473812, -41.1563385],
  [-71.4747602, -41.1571866], [-71.4753342, -41.1574532], [-71.4762367, -41.1579399], [-71.477083, -41.1586568],
  [-71.4787996, -41.1594686], [-71.4798027, -41.1600704], [-71.4810312, -41.1603248], [-71.4827438, -41.1616232],
  [-71.4827921, -41.1620261], [-71.482839, -41.1630196], [-71.4833164, -41.1639474], [-71.4844, -41.1650136],
  [-71.4848185, -41.1661847], [-71.4849365, -41.1672831], [-71.4860737, -41.1694718], [-71.4865136, -41.1702876],
  [-71.4864922, -41.171079], [-71.486291, -41.1737411], [-71.486063, -41.1747697], [-71.4854193, -41.1755934],
  [-71.4830482, -41.1760295], [-71.4816642, -41.1763686], [-71.4787567, -41.1778141], [-71.4782697, -41.17876],
  [-71.4753985, -41.1797845], [-71.4765036, -41.1814398], [-71.4758706, -41.1823361], [-71.475184, -41.1830063],
  [-71.4738536, -41.1830548], [-71.4715791, -41.1845647], [-71.4710909, -41.1848413], [-71.4655226, -41.1883071],
  [-71.4656783, -41.1896998], [-71.4637042, -41.1914115], [-71.4634467, -41.1922188], [-71.4574814, -41.1960617],
  [-71.4506498, -41.1982464], [-71.4395066, -41.199251], [-71.4388617, -41.19928], [-71.4301698, -41.1992381],
  [-71.4302139, -41.182225], [-71.4242521, -41.1821486], [-71.424313, -41.1731549], [-71.4158286, -41.1731633],
  [-71.4157596, -41.1731115], [-71.4157612, -41.1730565], [-71.4156249, -41.1730716], [-71.4156747, -41.1729237],
  [-71.4156065, -41.1727758], [-71.4156633, -41.1725769], [-71.4154873, -41.1723965], [-71.4154111, -41.1723634],
  [-71.4154368, -41.1722335], [-71.4151181, -41.1721473], [-71.4151057, -41.1720001], [-71.41475, -41.1714774],
  [-71.4145523, -41.1708646], [-71.4150228, -41.170222], [-71.4150549, -41.1701555], [-71.4149743, -41.1700768],
  [-71.415237, -41.1697136], [-71.4150382, -41.1696616], [-71.4151478, -41.1695106], [-71.4153233, -41.169421],
  [-71.4152172, -41.1688408], [-71.4149715, -41.1687606], [-71.4149136, -41.168628], [-71.415049, -41.1686108],
  [-71.4149575, -41.1678498], [-71.4146782, -41.1677228], [-71.4143825, -41.1671902], [-71.4145014, -41.1670687],
  [-71.4145474, -41.1670221], [-71.4145451, -41.1668988], [-71.4143707, -41.1667082], [-71.41425, -41.1655],
  [-71.4143013, -41.1654053], [-71.4143044, -41.1652339], [-71.4143799, -41.1651311], [-71.4143373, -41.1650364],
  [-71.4146875, -41.1647061], [-71.4147174, -41.1641343], [-71.4144018, -41.1635823], [-71.4142993, -41.1636737],
  [-71.4141247, -41.1635376], [-71.4140574, -41.1633976], [-71.4139069, -41.1633958], [-71.4138369, -41.1632769],
  [-71.4135789, -41.1632169], [-71.4135345, -41.1630831], [-71.4133211, -41.1630321], [-71.4127549, -41.1625888],
  [-71.412699, -41.1625422], [-71.4123521, -41.1623324], [-71.4121716, -41.162208], [-71.4120019, -41.1620433],
  [-71.4118001, -41.1618808], [-71.4116303, -41.1617595], [-71.4114304, -41.1616608], [-71.4113642, -41.1615663],
  [-71.4113165, -41.1614344], [-71.4112765, -41.1613733], [-71.4112189, -41.1613094], [-71.41115, -41.1612977],
  [-71.4110875, -41.161287], [-71.4109929, -41.1612978], [-71.4108481, -41.1612928], [-71.4105776, -41.1612628],
  [-71.4100117, -41.1610922], [-71.409692, -41.1610644], [-71.4094103, -41.1610954], [-71.4092461, -41.1611611],
  [-71.4091748, -41.1612214], [-71.4090991, -41.1612924], [-71.4090787, -41.1615007], [-71.4089464, -41.1614795],
  [-71.4087658, -41.1614908], [-71.4085126, -41.1615643], [-71.4083234, -41.16171], [-71.4077152, -41.1622983],
  [-71.4066586, -41.1629877], [-71.406286, -41.163073], [-71.4057262, -41.1634612], [-71.405204, -41.1640896],
  [-71.4048205, -41.1645075], [-71.4045792, -41.1647578], [-71.4041204, -41.1653515], [-71.4036296, -41.1661322],
  [-71.403308, -41.1666537], [-71.403062, -41.1672733], [-71.5881237, -41.0780743],
];

/** Un cuadrado cerrado holgado, para los casos que no dependen de la geometría real. */
const square = (lng = -71.3, lat = -41.13, size = 0.05): number[][] => [
  [lng - size, lat - size],
  [lng + size, lat - size],
  [lng + size, lat + size],
  [lng - size, lat + size],
  [lng - size, lat - size],
];

const isClosed = (ring: number[][]) =>
  ring.length >= 2 &&
  ring[0][0] === ring[ring.length - 1][0] &&
  ring[0][1] === ring[ring.length - 1][1];

// ── Utilidades de medición, INDEPENDIENTES del módulo ───────────────────────
//
// Se reimplementan acá a propósito: si el test midiera con las mismas funciones
// que el código bajo prueba, un error de proyección se cancelaría solo y el test
// daría verde con la geometría rota.

const METERS_PER_DEGREE = 111320;

/** Metros por grado de longitud a esa latitud. */
const lngMeters = (lat: number) => METERS_PER_DEGREE * Math.cos((lat * Math.PI) / 180);

/** Distancia en metros del punto al SEGMENTO a–b, sobre un plano local en `lat0`. */
const distanceToSegment = (
  p: number[],
  a: number[],
  b: number[],
  lat0: number,
): number => {
  const k = lngMeters(lat0);
  const px = p[0] * k;
  const py = p[1] * METERS_PER_DEGREE;
  let x = a[0] * k;
  let y = a[1] * METERS_PER_DEGREE;
  let dx = b[0] * k - x;
  let dy = b[1] * METERS_PER_DEGREE - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0] * k;
      y = b[1] * METERS_PER_DEGREE;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  return Math.hypot(px - x, py - y);
};

/** Distancia en metros del punto a la poligonal completa. */
const distanceToRing = (p: number[], ring: number[][], lat0: number): number => {
  let min = Infinity;
  for (let i = 1; i < ring.length; i++) {
    min = Math.min(min, distanceToSegment(p, ring[i - 1], ring[i], lat0));
  }
  return min;
};

const meanLat = (ring: number[][]) => ring.reduce((a, p) => a + p[1], 0) / ring.length;

// ── El contrato básico ──────────────────────────────────────────────────────

test('tolerancia 0 = sin simplificar: devuelve el MISMO anillo por identidad', () => {
  const ring = BARILOCHE_SLICE;
  const result = simplifyRing(ring, 0);
  assert.equal(result.ring, ring, 'no tiene que copiar ni reconstruir nada');
  assert.equal(result.before, 150);
  assert.equal(result.after, 150);
  assert.equal(result.floored, false);
});

test('una tolerancia no finita se trata como "sin simplificar"', () => {
  for (const tolerance of [Number.NaN, Number.POSITIVE_INFINITY, -25]) {
    const result = simplifyRing(BARILOCHE_SLICE, tolerance);
    assert.equal(result.ring, BARILOCHE_SLICE, `tolerancia ${tolerance}`);
  }
});

test('el anillo cerrado sale cerrado', () => {
  const result = simplifyRing(BARILOCHE_SLICE, 25);
  assert.ok(isClosed(result.ring), 'primer punto == último');
  assert.deepEqual(result.ring[0], result.ring[result.ring.length - 1]);
});

test('los vértices se cuentan SIN el punto de cierre', () => {
  // 151 posiciones en el fixture = 150 vértices... salvo que la posición 150 es
  // el cierre, así que son 149. El número que ve el operador es este.
  assert.equal(BARILOCHE_SLICE.length, 151);
  assert.equal(simplifyRing(BARILOCHE_SLICE, 0).before, 150);
});

test('RDP sólo DESCARTA: cada punto que sale estaba en la entrada, en el mismo orden', () => {
  const result = simplifyRing(BARILOCHE_SLICE, 25);
  const source = BARILOCHE_SLICE.slice(0, -1);
  let cursor = 0;
  for (const point of result.ring.slice(0, -1)) {
    const found = source.indexOf(point, cursor);
    assert.notEqual(found, -1, `${JSON.stringify(point)} no está en el anillo original`);
    cursor = found + 1;
  }
});

test('los puntos que sobreviven salen con los dígitos del archivo, sin ida y vuelta', () => {
  const result = simplifyRing(BARILOCHE_SLICE, 25);
  // Identidad de referencia, no igualdad numérica: son los objetos ORIGINALES.
  // Si alguna vez se desproyectara de metros a grados, esto se rompe primero.
  assert.equal(result.ring[0], BARILOCHE_SLICE[0]);
  assert.equal(result.ring[result.ring.length - 1], BARILOCHE_SLICE[0]);
  assert.equal(String(result.ring[0][0]), '-71.5881237', 'los 7 decimales intactos');
});

// ── La tolerancia está en METROS ────────────────────────────────────────────

test('la tolerancia es una COTA: ningún vértice descartado queda a más de N metros del borde nuevo', () => {
  for (const tolerance of [10, 25, 50, 100]) {
    const result = simplifyRing(BARILOCHE_SLICE, tolerance);
    const lat0 = meanLat(BARILOCHE_SLICE.slice(0, -1));
    let worst = 0;
    for (const point of BARILOCHE_SLICE) {
      worst = Math.max(worst, distanceToRing(point, result.ring, lat0));
    }
    assert.ok(
      worst <= tolerance + 1e-6,
      `con tolerancia ${tolerance} m el peor vértice quedó a ${worst.toFixed(2)} m`,
    );
  }
});

test('la tolerancia NO depende de la dirección: 21 m al este pesan lo mismo que 21 m al norte', () => {
  /**
   * EL TEST QUE FIJA "metros, no grados".
   *
   * A latitud −41: 1° de longitud = 84.014 m, 1° de latitud = 111.320 m.
   *
   * Se eligen 21 m de desvío contra una tolerancia de 25 m a propósito. Una
   * implementación que corriera RDP sobre grados con el umbral "25 m / 111.320"
   * contestaría:
   *   - desvío al norte  → 21/111.320 = 1,886e-4 < umbral → lo descarta ✓
   *   - desvío al este   → 21/84.014  = 2,499e-4 > umbral → lo CONSERVA ✗
   * Los dos son el mismo desplazamiento de 21 metros. Acá los dos se descartan.
   */
  const lat0 = -41;
  const bump = 21;
  const dLat = bump / METERS_PER_DEGREE;
  const dLng = bump / lngMeters(lat0);

  const west = -71.01;
  const east = -70.99;
  const south = lat0 - 0.01;
  const north = lat0 + 0.01;

  /** Rectángulo con un vértice extra empujado `dLat` al NORTE, en el medio del borde norte. */
  const bumpedNorth: number[][] = [
    [west, south],
    [east, south],
    [east, north],
    [(west + east) / 2, north + dLat],
    [west, north],
    [west, south],
  ];

  /** El mismo rectángulo con el vértice extra empujado `dLng` al ESTE, en el borde este. */
  const bumpedEast: number[][] = [
    [west, south],
    [west, north],
    [east, north],
    [east + dLng, (south + north) / 2],
    [east, south],
    [west, south],
  ];

  const north25 = simplifyRing(bumpedNorth, 25);
  const east25 = simplifyRing(bumpedEast, 25);
  assert.equal(north25.after, 4, '21 m al norte están por debajo de 25 m: se descarta');
  assert.equal(east25.after, 4, '21 m al este TAMBIÉN están por debajo de 25 m: se descarta');

  // Y con una tolerancia por debajo del desvío, los dos lo conservan.
  assert.equal(simplifyRing(bumpedNorth, 10).after, 5);
  assert.equal(simplifyRing(bumpedEast, 10).after, 5);
});

// ── El piso de 4 posiciones ─────────────────────────────────────────────────

test('Maquinchao (5 posiciones, el área más chica del archivo) sale INTACTA', () => {
  for (const tolerance of SIMPLIFY_TOLERANCES_M) {
    const result = simplifyRing(MAQUINCHAO, tolerance);
    assert.deepEqual(result.ring, MAQUINCHAO, `con tolerancia ${tolerance} m`);
    assert.equal(result.ring.length, MIN_RING_POSITIONS + 1);
    assert.equal(result.after, 4);
  }
});

test('el piso devuelve el original y lo DICE: un anillo de 3 vértices no se toca', () => {
  // Un triángulo tan chato que RDP lo dejaría en dos puntos: un segmento, no un
  // polígono. `polygon-engine.ts` devuelve 'outside' para todo con menos de 3
  // vértices, o sea que la zona quedaría creada y sin cubrir a nadie.
  const flat: number[][] = [
    [-71.0, -41.0],
    [-70.99, -41.000001],
    [-70.98, -41.0],
    [-71.0, -41.0],
  ];
  const result = simplifyRing(flat, 100);
  assert.equal(result.ring, flat, 'devuelve el original por identidad');
  assert.equal(result.after, result.before);
  assert.equal(result.floored, true, 'y queda marcado para que la UI lo muestre');
});

test('`floored` no es lo mismo que "quedó igual"', () => {
  // El cuadrado no pierde vértices porque ninguno sobra, no porque el piso lo
  // frene. Confundir las dos cosas haría que la UI marque como "no se pudo"
  // algo que simplemente ya estaba óptimo.
  const result = simplifyRing(square(), 25);
  assert.equal(result.after, result.before);
  assert.equal(result.floored, false);
});

test('un anillo degenerado (menos de 2 posiciones) no rompe', () => {
  assert.equal(simplifyRing([], 25).after, 0);
  assert.equal(simplifyRing([[-71, -41]], 25).after, 1);
});

// ── Geometría real: la reducción tiene que ser sustancial ───────────────────

test('el borde real de Bariloche baja sustancialmente y el default es razonable', () => {
  const at = (tolerance: number) => simplifyRing(BARILOCHE_SLICE, tolerance).after;

  assert.equal(at(0), 150);
  assert.equal(at(10), 83);
  assert.equal(at(25), 54);
  assert.equal(at(50), 43);
  assert.equal(at(100), 32);

  // El default tiene que sacar la mayor parte: OSM trae un vértice por metro.
  const kept = at(DEFAULT_SIMPLIFY_TOLERANCE_M) / at(0);
  assert.ok(kept < 0.45, `a 25 m quedó el ${(kept * 100).toFixed(0)} % de los vértices`);

  // Y más tolerancia nunca puede dejar MÁS vértices.
  const series = SIMPLIFY_TOLERANCES_M.map(at);
  for (let i = 1; i < series.length; i++) {
    assert.ok(series[i] <= series[i - 1], `${SIMPLIFY_TOLERANCES_M[i]} m dejó más que el anterior`);
  }
});

test('el anillo simplificado no colapsa: conserva el área dentro del 1 %', () => {
  const shoelace = (ring: number[][]) => {
    let sum = 0;
    for (let i = 1; i < ring.length; i++) {
      sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
    }
    return Math.abs(sum / 2);
  };
  const original = shoelace(BARILOCHE_SLICE);
  const simplified = shoelace(simplifyRing(BARILOCHE_SLICE, 25).ring);
  assert.ok(
    Math.abs(simplified - original) / original < 0.01,
    `el área cambió un ${((Math.abs(simplified - original) / original) * 100).toFixed(2)} %`,
  );
});

// ── `simplifyAreas`: lo que la UI muestra ───────────────────────────────────

test('el total y el detalle por área cuadran, y el nombre viaja', () => {
  const areas = [
    { name: 'Bariloche', ring: BARILOCHE_SLICE },
    { name: 'Maquinchao', ring: MAQUINCHAO },
    { ring: square() },
  ];
  const result = simplifyAreas(areas, 25);

  assert.equal(result.detail.length, 3);
  assert.equal(result.before, result.detail.reduce((t, d) => t + d.before, 0));
  assert.equal(result.after, result.detail.reduce((t, d) => t + d.after, 0));
  assert.equal(result.before, 150 + 4 + 4);
  assert.equal(result.after, 54 + 4 + 4);
  assert.equal(result.changed, true);

  assert.deepEqual(
    result.detail.map((d) => [d.index, d.name, d.before, d.after, d.floored]),
    [
      [0, 'Bariloche', 150, 54, false],
      [1, 'Maquinchao', 4, 4, false],
      [2, undefined, 4, 4, false],
    ],
  );
});

test('las áreas que no cambian salen por IDENTIDAD, no clonadas', () => {
  // Importa: el panel compara contra `result.areas` para decidir qué mostrar, y
  // clonar 26 áreas en cada render del selector es trabajo regalado.
  const maquinchao = { name: 'Maquinchao', ring: MAQUINCHAO };
  const result = simplifyAreas([maquinchao], 25);
  assert.equal(result.areas[0], maquinchao);
});

test('simplificar preserva `name` y `active` del área', () => {
  const result = simplifyAreas([{ name: 'Bariloche', active: false, ring: BARILOCHE_SLICE }], 25);
  assert.equal(result.areas[0].name, 'Bariloche');
  assert.equal(result.areas[0].active, false);
  assert.notEqual(result.areas[0].ring, BARILOCHE_SLICE, 'ésta sí cambió');
});

test('con tolerancia 0 no cambia nada y `changed` es false', () => {
  const areas = [{ name: 'Bariloche', ring: BARILOCHE_SLICE }];
  const result = simplifyAreas(areas, 0);
  assert.equal(result.changed, false);
  assert.equal(result.areas[0], areas[0]);
  assert.equal(result.flooredCount, 0);
});

test('`flooredCount` cuenta las áreas que el piso dejó intactas', () => {
  const flat: number[][] = [
    [-71.0, -41.0],
    [-70.99, -41.000001],
    [-70.98, -41.0],
    [-71.0, -41.0],
  ];
  const result = simplifyAreas([{ ring: flat }, { ring: BARILOCHE_SLICE }], 100);
  assert.equal(result.flooredCount, 1);
  assert.equal(result.detail[0].floored, true);
  assert.equal(result.detail[1].floored, false);
});

test('el porcentaje que ve el operador no divide por cero', () => {
  assert.equal(reductionPercent(0, 0), 0);
  assert.equal(reductionPercent(16687, 1758), 89);
  assert.equal(reductionPercent(100, 100), 0);
});

test('el default del selector es una de las opciones ofrecidas', () => {
  assert.ok(SIMPLIFY_TOLERANCES_M.includes(DEFAULT_SIMPLIFY_TOLERANCE_M as never));
  assert.equal(DEFAULT_SIMPLIFY_TOLERANCE_M, 25);
  assert.equal(SIMPLIFY_TOLERANCES_M[0], 0, 'la primera opción es "sin simplificar"');
});
