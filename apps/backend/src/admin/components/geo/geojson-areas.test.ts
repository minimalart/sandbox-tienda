import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countVertices,
  extractGeoJsonAreas,
  MAX_NAME_LENGTH,
  ringToPolygonPoints,
} from './geojson-areas.ts';

/**
 * EL BUG QUE ESTE TEST FIJA.
 *
 * El picker tenía un `extractFirstRing`: se quedaba con la primera geometría y
 * tiraba el resto sin decir nada. Un `MultiPolygon` con 21 polígonos entraba
 * como uno solo —el #0— y las cuatro sucursales de Bariloche terminaron con el
 * polígono de Junín de los Andes, a 130 km, las cuatro iguales.
 *
 * Así que lo que se testea no es sólo "extrae bien": es que **nada se pierda en
 * silencio**. Cada caso comprueba el conteo Y el reporte.
 */

/** Un cuadrado cerrado de lado `size` centrado en (lng, lat). Orden GeoJSON. */
const square = (lng: number, lat: number, size = 0.1): number[][] => [
  [lng - size, lat - size],
  [lng + size, lat - size],
  [lng + size, lat + size],
  [lng - size, lat + size],
  [lng - size, lat - size],
];

const polygon = (rings: number[][][]) => ({ type: 'Polygon', coordinates: rings });
const multiPolygon = (polygons: number[][][][]) => ({ type: 'MultiPolygon', coordinates: polygons });
const feature = (geometry: unknown, properties: Record<string, unknown> | null = null) => ({
  type: 'Feature',
  properties,
  geometry,
});
const collection = (features: unknown[]) => ({ type: 'FeatureCollection', features });

// ── Formas de entrada ───────────────────────────────────────────────────────

test('geometría desnuda: un Polygon es UNA área', () => {
  const result = extractGeoJsonAreas(polygon([square(-71.3, -41.13)]));
  assert.equal(result.areas.length, 1);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.discarded, []);
  assert.equal(result.ignoredHoles, 0);
});

test('geometría desnuda: un MultiPolygon de 21 polígonos son 21 áreas', () => {
  // Réplica de la forma del archivo real: 1 geometría, 21 polígonos
  // independientes, 1 anillo cada uno.
  const polygons = Array.from({ length: 21 }, (_, i) => [square(-71.3 + i * 0.5, -41.13)]);
  const result = extractGeoJsonAreas(multiPolygon(polygons));

  assert.equal(result.areas.length, 21, 'el bug original devolvía 1');
  assert.equal(result.ignoredHoles, 0);
  assert.deepEqual(result.discarded, []);
  // Y NO son todas el mismo polígono, que es exactamente lo que pasó en producción.
  const distinct = new Set(result.areas.map((a) => JSON.stringify(a.ring)));
  assert.equal(distinct.size, 21);
});

test('Feature suelto: hereda el nombre de properties', () => {
  const result = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: 'Bariloche centro' }),
  );
  assert.equal(result.areas.length, 1);
  assert.equal(result.areas[0]?.name, 'Bariloche centro');
});

test('FeatureCollection: recorre TODAS las features, no sólo la primera', () => {
  const result = extractGeoJsonAreas(
    collection([
      feature(polygon([square(-71.3, -41.13)]), { name: 'Bariloche' }),
      feature(polygon([square(-71.1, -41.0)]), { name: 'Dina Huapi' }),
      feature(multiPolygon([[square(-70.9, -40.8)], [square(-70.7, -40.6)]]), { name: 'Villa La Angostura' }),
    ]),
  );

  assert.equal(result.areas.length, 4);
  assert.deepEqual(result.areas.map((a) => a.name), [
    'Bariloche',
    'Dina Huapi',
    // La feature que aporta dos áreas se desambigua con sufijo.
    'Villa La Angostura 1',
    'Villa La Angostura 2',
  ]);
});

test('el archivo VIEJO: 1 feature con nombre agregado y 21 polígonos → 21 nombres con sufijo', () => {
  // `cobertura_final.geojson` es exactamente esto: el nombre está a nivel de la
  // feature ("Cobertura estándar Desde el Sur") y NO hay nombre por polígono.
  const polygons = Array.from({ length: 21 }, (_, i) => [square(-71.3 + i * 0.15, -41.13)]);
  const result = extractGeoJsonAreas(
    collection([
      feature(multiPolygon(polygons), {
        name: 'Cobertura estándar Desde el Sur',
        locality_count: 21,
        coordinate_order: '[longitude, latitude]',
      }),
    ]),
  );

  assert.equal(result.areas.length, 21);
  assert.equal(result.areas[0]?.name, 'Cobertura estándar Desde el Sur 1');
  assert.equal(result.areas[20]?.name, 'Cobertura estándar Desde el Sur 21');
  // Una línea con el conteo, no 21 líneas iguales.
  assert.equal(result.adjustedNames.length, 1);
  assert.equal(result.adjustedNames[0]?.count, 21);
});

// ── El archivo DEFINITIVO: 21 features con nombre de localidad ──────────────

/** Las 21 localidades del archivo definitivo, en el orden en que vienen. */
const LOCALIDADES = [
  'Junín de los Andes',
  'San Martín de los Andes',
  'Villa La Angostura',
  'Bariloche',
  'Dina Huapi',
  'El Bolsón',
  'Lago Puelo',
  'Esquel',
  'Trevelin',
  'Neuquén Capital',
  'Añelo',
  'Catriel',
  'Zapala',
  'Cutral-co',
  '25 de Mayo',
  'Plaza Huincul',
  'Picún Leufú',
  'Piedra del Águila',
  'Pilcaniyeu',
  'Jacobacci',
  'Maquinchao',
];

/** Réplica del archivo definitivo: name + active + priority + zone por feature. */
const archivoDefinitivo = () =>
  collection(
    LOCALIDADES.map((name, i) =>
      feature(polygon([square(-71.5 + i * 0.2, -41.5 + i * 0.1)]), {
        name,
        active: true,
        priority: i + 1,
        zone: i < 9 ? 'Cordillera' : i < 18 ? 'Neuquén y alrededores' : 'Línea Sur',
      }),
    ),
  );

test('el archivo DEFINITIVO: 21 coberturas con nombre de localidad, NO numeradas', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());

  assert.equal(result.areas.length, 21);
  assert.deepEqual(result.areas.map((a) => a.name), LOCALIDADES);
  assert.deepEqual(result.adjustedNames, [], 'no hay duplicados ni nombres largos');
  assert.equal(result.ignoredHoles, 0);
  assert.deepEqual(result.discarded, []);
  assert.deepEqual(result.unsupported, []);
});

test('las tildes y la ñ NO se tocan: son parte del nombre de la localidad', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());
  const names = result.areas.map((a) => a.name);
  assert.ok(names.includes('Junín de los Andes'));
  assert.ok(names.includes('Añelo'));
  assert.ok(names.includes('Picún Leufú'));
  assert.ok(names.includes('Piedra del Águila'));
  assert.ok(names.includes('Cutral-co'), 'el guión tampoco');
});

test('`active` SÍ se importa: misma semántica que branch_coverage.active', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());
  assert.equal(result.activeFromFile, 21);
  assert.ok(result.areas.every((a) => a.active === true));

  // Y un `false` del archivo no se pierde.
  const apagada = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: 'Zona apagada', active: false }),
  );
  assert.equal(apagada.areas[0]?.active, false);
});

test('`active` que no es booleano no se inventa: queda sin definir', () => {
  const result = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: 'Zona', active: 'sí' }),
  );
  assert.equal(result.areas[0]?.active, undefined);
  assert.equal(result.activeFromFile, 0);
  // Y como no se consumió, se reporta.
  assert.ok(result.ignoredProperties.includes('active'));
});

test('`priority` NO se importa y se REPORTA: el archivo es un orden, el modelo un peso', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());
  // El archivo trae 1..21 (1 = primero); el modelo desempata con mayor-gana.
  // Copiarlo haría que Maquinchao (21) le ganara a Bariloche (4).
  assert.ok(result.ignoredProperties.includes('priority'));
  assert.ok(!('priority' in (result.areas[0] as object)));
});

test('`zone` no se importa (el modelo no lo tiene) y aparece en el reporte', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());
  assert.ok(result.ignoredProperties.includes('zone'));
  // El nombre queda limpio: la localidad sola, sin "(Cordillera)" pegado.
  assert.equal(result.areas[0]?.name, 'Junín de los Andes');
});

test('la regla: TODA property no importada sale en el reporte, ordenada', () => {
  const result = extractGeoJsonAreas(archivoDefinitivo());
  // `name` y `active` se consumen; `priority` y `zone` no.
  assert.deepEqual(result.ignoredProperties, ['priority', 'zone']);
});

test('el archivo VIEJO reporta su metadata documental como no importada', () => {
  const result = extractGeoJsonAreas(
    collection([
      feature(multiPolygon([[square(-71.3, -41.13)], [square(-70.0, -41.13)]]), {
        name: 'Cobertura estándar Desde el Sur',
        description: 'Cobertura final…',
        important: 'las áreas no se unen entre sí',
        locality_count: 21,
        coordinate_order: '[longitude, latitude]',
        medusa_mapping: 'x=longitude, y=latitude',
        zones: ['Cordillera'],
      }),
    ]),
  );
  assert.deepEqual(result.ignoredProperties, [
    'coordinate_order',
    'description',
    'important',
    'locality_count',
    'medusa_mapping',
    'zones',
  ]);
  assert.equal(result.activeFromFile, 0, 'el archivo viejo no trae active');
});

test('una property en null no se reporta como no importada (no la trae de verdad)', () => {
  const result = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: 'Zona', zone: null }),
  );
  assert.deepEqual(result.ignoredProperties, ['zone']);
});

// ── Sanitización de nombres ─────────────────────────────────────────────────

test('el nombre se limpia: trim y espacios internos colapsados', () => {
  const result = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: '  San   Martín\tde\nlos  Andes  ' }),
  );
  assert.equal(result.areas[0]?.name, 'San Martín de los Andes');
});

test('nombre vacío o en blanco = sin nombre (nunca una fila con name vacío)', () => {
  for (const name of ['', '   ', '\n\t ']) {
    const result = extractGeoJsonAreas(feature(polygon([square(-71.3, -41.13)]), { name }));
    assert.equal(result.areas[0]?.name, undefined, `falló con ${JSON.stringify(name)}`);
  }
});

test('nombre no-string se ignora y se cae al siguiente candidato', () => {
  const result = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { name: 42, localidad: 'Zapala' }),
  );
  assert.equal(result.areas[0]?.name, 'Zapala');
});

test('nombre demasiado largo: se recorta Y se reporta', () => {
  const largo = 'Zona '.repeat(60).trim(); // muy por encima del tope
  const result = extractGeoJsonAreas(feature(polygon([square(-71.3, -41.13)]), { name: largo }));

  const name = result.areas[0]?.name ?? '';
  assert.ok(name.length <= MAX_NAME_LENGTH);
  assert.equal(result.adjustedNames.length, 1);
  assert.equal(result.adjustedNames[0]?.reason, 'truncated');
  assert.equal(result.adjustedNames[0]?.to, name);
});

test('nombres duplicados: se desambiguan con sufijo Y se reportan (no se pisan)', () => {
  const result = extractGeoJsonAreas(
    collection([
      feature(polygon([square(-71.3, -41.13)]), { name: 'Bariloche' }),
      feature(polygon([square(-70.0, -41.13)]), { name: 'Bariloche' }),
      feature(polygon([square(-69.0, -41.13)]), { name: '  Bariloche  ' }),
    ]),
  );

  assert.deepEqual(result.areas.map((a) => a.name), ['Bariloche 1', 'Bariloche 2', 'Bariloche 3']);
  assert.equal(new Set(result.areas.map((a) => a.name)).size, 3, 'ninguna pisa a otra');
  // Un solo ajuste, con su conteo: 21 líneas idénticas serían un muro ilegible.
  assert.deepEqual(result.adjustedNames, [
    { from: 'Bariloche', to: 'Bariloche 1', reason: 'duplicate', count: 3 },
  ]);
});

test('el sufijo sobrevive al recorte: dos nombres largos e iguales no colisionan', () => {
  const largo = 'A'.repeat(MAX_NAME_LENGTH + 40);
  const result = extractGeoJsonAreas(
    collection([
      feature(polygon([square(-71.3, -41.13)]), { name: largo }),
      feature(polygon([square(-70.0, -41.13)]), { name: largo }),
    ]),
  );
  const names = result.areas.map((a) => a.name ?? '');
  assert.equal(new Set(names).size, 2, 'el recorte no puede comerse el sufijo');
  assert.ok(names.every((n) => n.length <= MAX_NAME_LENGTH));
});

test('feature con MultiPolygon dentro del archivo nuevo: el sufijo por área sigue andando', () => {
  const result = extractGeoJsonAreas(
    collection([
      feature(polygon([square(-71.3, -41.13)]), { name: 'Bariloche', active: true }),
      feature(multiPolygon([[square(-70.5, -41.0)], [square(-70.2, -40.8)]]), {
        name: 'Esquel',
        active: true,
        priority: 2,
      }),
      feature(polygon([square(-69.0, -41.13)]), { name: 'Zapala', active: false }),
    ]),
  );

  assert.deepEqual(result.areas.map((a) => a.name), [
    'Bariloche',
    'Esquel 1',
    'Esquel 2',
    'Zapala',
  ]);
  // La metadata de la feature se hereda a las DOS áreas que aporta.
  assert.deepEqual(result.areas.map((a) => a.active), [true, true, true, false]);
  assert.deepEqual(result.adjustedNames, [
    { from: 'Esquel', to: 'Esquel 1', reason: 'duplicate', count: 2 },
  ]);
});

test('GeometryCollection: se recorre, no se rechaza', () => {
  const result = extractGeoJsonAreas({
    type: 'GeometryCollection',
    geometries: [polygon([square(-71.3, -41.13)]), multiPolygon([[square(-71.0, -41.0)]])],
  });
  assert.equal(result.areas.length, 2);
  assert.equal(result.error, undefined);
});

test('sin nombre: `name` queda undefined (numerar es texto de UI, va por i18n)', () => {
  const result = extractGeoJsonAreas(collection([feature(polygon([square(-71.3, -41.13)]))]));
  assert.equal(result.areas.length, 1);
  assert.equal(result.areas[0]?.name, undefined);
});

test('nombre alternativo: nombre / localidad', () => {
  const porNombre = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { nombre: 'El Bolsón' }),
  );
  const porLocalidad = extractGeoJsonAreas(
    feature(polygon([square(-71.3, -41.13)]), { localidad: 'Cipolletti' }),
  );
  assert.equal(porNombre.areas[0]?.name, 'El Bolsón');
  assert.equal(porLocalidad.areas[0]?.name, 'Cipolletti');
});

// ── Agujeros ────────────────────────────────────────────────────────────────

test('agujeros: usa el exterior y REPORTA cuántos anillos interiores ignoró', () => {
  const conDosAgujeros = polygon([
    square(-71.3, -41.13, 1),
    square(-71.35, -41.15, 0.05),
    square(-71.25, -41.1, 0.05),
  ]);
  const result = extractGeoJsonAreas(conDosAgujeros);

  assert.equal(result.areas.length, 1);
  assert.equal(result.ignoredHoles, 2, 'el motor evalúa UNA lista de vértices: los agujeros no caben');
  // Y el anillo que quedó es el EXTERIOR, no un agujero.
  assert.deepEqual(result.areas[0]?.ring, square(-71.3, -41.13, 1));
});

test('agujeros: se suman a través de varias áreas', () => {
  const result = extractGeoJsonAreas(
    multiPolygon([
      [square(-71.3, -41.13, 1), square(-71.3, -41.13, 0.1)],
      [square(-70.0, -41.13, 1)],
      [square(-69.0, -41.13, 1), square(-69.0, -41.13, 0.2), square(-69.1, -41.2, 0.05)],
    ]),
  );
  assert.equal(result.areas.length, 3);
  assert.equal(result.ignoredHoles, 3);
});

// ── Validación ──────────────────────────────────────────────────────────────

test('menos de 3 vértices: se descarta Y se reporta, sin tumbar el resto', () => {
  const result = extractGeoJsonAreas(
    multiPolygon([
      [square(-71.3, -41.13)],
      [[[-70.0, -41.0], [-70.1, -41.1], [-70.0, -41.0]]], // 2 vértices distintos
      [square(-69.0, -41.13)],
    ]),
  );

  assert.equal(result.areas.length, 2, 'las áreas buenas siguen entrando');
  assert.equal(result.discarded.length, 1);
  assert.equal(result.discarded[0]?.reason, 'too_few_points');
  assert.equal(result.discarded[0]?.detail, '2');
  assert.equal(result.discarded[0]?.label, '#2', 'el número es la posición en el archivo');
});

test('el descarte no renumera a las que siguen', () => {
  const result = extractGeoJsonAreas(
    multiPolygon([[square(-71.3, -41.13)], [[]], [square(-69.0, -41.13)]]),
  );
  assert.equal(result.discarded[0]?.label, '#2');
  assert.equal(result.areas.length, 2);
});

test('coordenada no finita: se rechaza con el valor culpable', () => {
  const result = extractGeoJsonAreas(
    polygon([[[-71.3, -41.1], [Number.NaN, -41.2], [-71.1, -41.3], [-71.3, -41.1]]]),
  );
  assert.deepEqual(result.areas, []);
  assert.equal(result.discarded[0]?.reason, 'non_finite');
  assert.match(result.discarded[0]?.detail ?? '', /NaN/);
});

test('coordenada no numérica (string) también es non_finite', () => {
  const result = extractGeoJsonAreas(
    polygon([[['-71.3', '-41.1'], [-71.2, -41.2], [-71.1, -41.3], ['-71.3', '-41.1']]]),
  );
  assert.equal(result.discarded[0]?.reason, 'non_finite');
});

test('fuera de rango: lng > 180 y lat > 90 se rechazan', () => {
  const lng = extractGeoJsonAreas(
    polygon([[[181, -41.1], [-71.2, -41.2], [-71.1, -41.3], [181, -41.1]]]),
  );
  const lat = extractGeoJsonAreas(
    polygon([[[-71.3, 91], [-71.2, -41.2], [-71.1, -41.3], [-71.3, 91]]]),
  );
  assert.equal(lng.discarded[0]?.reason, 'out_of_range');
  assert.equal(lat.discarded[0]?.reason, 'out_of_range');
});

test('los límites exactos (±180 / ±90) son válidos', () => {
  const result = extractGeoJsonAreas(
    polygon([[[-180, -90], [180, -90], [180, 90], [-180, -90]]]),
  );
  assert.equal(result.areas.length, 1);
});

test('anillo mal formado: posiciones que no son [lng, lat]', () => {
  const result = extractGeoJsonAreas(polygon([[[-71.3], [-71.2, -41.2], [-71.1, -41.3]]]));
  assert.equal(result.discarded[0]?.reason, 'malformed_ring');
});

test('geometrías que no son polígonos: se saltean pero se DICEN', () => {
  const result = extractGeoJsonAreas(
    collection([
      feature({ type: 'Point', coordinates: [-71.3, -41.13] }, { name: 'Sucursal' }),
      feature({ type: 'LineString', coordinates: [[-71.3, -41.1], [-71.2, -41.2]] }),
      feature(polygon([square(-71.3, -41.13)]), { name: 'Zona' }),
    ]),
  );
  assert.equal(result.areas.length, 1);
  assert.deepEqual(result.unsupported, ['Point', 'LineString']);
});

test('nada usable: error explícito, no una lista vacía muda', () => {
  assert.equal(extractGeoJsonAreas(null).error, 'not_geojson');
  assert.equal(extractGeoJsonAreas('{}').error, 'not_geojson');
  assert.equal(extractGeoJsonAreas(42).error, 'not_geojson');
  assert.equal(extractGeoJsonAreas({ type: 'FeatureCollection', features: [] }).error, 'no_polygon');
  assert.equal(extractGeoJsonAreas({ type: 'Point', coordinates: [1, 2] }).error, 'no_polygon');
});

test('cuando todo se descartó, el motivo son los descartes y no un error genérico', () => {
  const result = extractGeoJsonAreas(polygon([[[-71.3, -41.1], [-71.2, -41.2]]]));
  assert.deepEqual(result.areas, []);
  assert.equal(result.error, undefined, 'el detalle ya está en discarded[]');
  assert.equal(result.discarded.length, 1);
});

test('colecciones anidadas hasta el infinito no cuelgan el navegador', () => {
  let node: unknown = polygon([square(-71.3, -41.13)]);
  for (let i = 0; i < 50; i++) node = { type: 'GeometryCollection', geometries: [node] };
  const result = extractGeoJsonAreas(node);
  // No importa cuántas encuentre: importa que TERMINE.
  assert.ok(Array.isArray(result.areas));
});

// ── Orden de coordenadas (la trampa) ────────────────────────────────────────

test('el orden se preserva: GeoJSON [lng, lat] → storage {x: lng, y: lat}', () => {
  const result = extractGeoJsonAreas(polygon([square(-71.3, -41.13)]));
  const ring = result.areas[0]?.ring ?? [];
  // Bariloche: lng ≈ -71 (x), lat ≈ -41 (y). Invertirlo lo manda al Índico.
  assert.ok(ring.every(([lng, lat]) => lng < -70 && lat > -42 && lat < -41));

  const points = ringToPolygonPoints(ring);
  assert.ok(points.every((p) => Number(p.x) < -70), 'x tiene que ser la LONGITUD');
  assert.ok(points.every((p) => Number(p.y) > -42 && Number(p.y) < -41), 'y tiene que ser la LATITUD');
  assert.equal(typeof points[0]?.x, 'string', 'el storage guarda strings');
});

test('la altitud (3er elemento) se descarta: el motor es 2D', () => {
  const result = extractGeoJsonAreas(
    polygon([[[-71.3, -41.1, 800], [-71.2, -41.2, 810], [-71.1, -41.3, 795], [-71.3, -41.1, 800]]]),
  );
  assert.deepEqual(result.areas[0]?.ring, [[-71.3, -41.1], [-71.2, -41.2], [-71.1, -41.3], [-71.3, -41.1]]);
});

// ── Conversión a storage ────────────────────────────────────────────────────

test('ringToPolygonPoints cierra el anillo si el archivo lo trae abierto', () => {
  const abierto = [[-71.3, -41.1], [-71.2, -41.2], [-71.1, -41.3]];
  const points = ringToPolygonPoints(abierto);
  assert.equal(points.length, 4);
  assert.deepEqual(points[3], points[0]);
});

test('ringToPolygonPoints no duplica el cierre si ya viene cerrado', () => {
  const points = ringToPolygonPoints(square(-71.3, -41.13));
  assert.equal(points.length, 5);
  assert.deepEqual(points[4], points[0]);
});

test('countVertices no cuenta el punto de cierre', () => {
  const result = extractGeoJsonAreas(
    multiPolygon([[square(-71.3, -41.13)], [square(-70.0, -41.13)]]),
  );
  // Dos cuadrados: 5 posiciones cada uno, 4 vértices reales cada uno.
  assert.equal(countVertices(result.areas), 8);
});
