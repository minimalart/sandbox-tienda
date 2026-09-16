/**
 * Genera el catálogo de zonas de Argentina del store locator.
 *
 *   cd apps/backend
 *   node --experimental-transform-types --import ./test-register.mjs \
 *     src/scripts/build-geo-zones-ar.mjs
 *
 * (las dos flags son las mismas que usa `pnpm test`: hacen falta para importar
 * el .ts de simplify-ring, que además usa imports sin extensión)
 *
 * Baja los límites provinciales oficiales del Servicio de Normalización de
 * Datos Geográficos (georef, JGM — datos del IGN, datos abiertos) y escribe
 * `apps/storefront/src/lib/data/geo-zones-ar.ts`, que es la ÚNICA copia de las
 * geometrías del catálogo. El backend sólo tiene el índice de ids y nombres
 * (`apps/backend/src/lib/geo-zones-ar-index.ts`); si esta lista cambia, hay que
 * actualizar los dos — el script avisa si dejaron de coincidir.
 *
 * Qué le hace al archivo original (614 KB, y con la Antártida adentro):
 *
 *  - **Descarta los agujeros.** El point-in-polygon del storefront los soporta,
 *    pero para decidir "esta sucursal cae en esta provincia" no aportan nada.
 *  - **Descarta las islas chicas y todo lo que esté fuera del bbox continental
 *    + Tierra del Fuego.** Sin esto, Tierra del Fuego se trae el sector
 *    antártico y las islas del Atlántico Sur: 1.499 anillos y 15.574 puntos
 *    para una provincia con menos de 200.000 habitantes.
 *  - **Simplifica con Douglas-Peucker** a `TOLERANCE_M`. A escala provincial la
 *    precisión sub-kilométrica no cambia en qué zona cae una sucursal, y sí
 *    cambia el peso de lo que se manda al browser.
 *
 * El archivo generado se commitea: no se baja nada en build time.
 */
import { writeFileSync } from 'node:fs';
import { simplifyRing } from '../admin/components/geo/simplify-ring.ts';
import { GEO_ZONES_AR_INDEX } from '../lib/geo-zones-ar-index.ts';

const SOURCE = 'https://infra.datos.gob.ar/georef/provincias.geojson';
const OUT = new URL('../../../storefront/src/lib/data/geo-zones-ar.ts', import.meta.url);

/** Tolerancia de simplificación. ~1 km: invisible a escala provincial. */
const TOLERANCE_M = 1000;

/** Continente + Tierra del Fuego. Deja afuera la Antártida y el Atlántico Sur. */
const MAINLAND = { minLng: -74, maxLng: -53, minLat: -56, maxLat: -21 };

/** Un polígono que aporta menos que esto del área de su provincia se descarta. */
const MIN_AREA_SHARE = 0.001;
const MAX_POLYGONS_PER_ZONE = 12;

/** Código INDEC → id ISO 3166-2:AR en minúscula. Los ids son la clave estable. */
const ISO_BY_INDEC = {
  '02': 'ar-c',
  '06': 'ar-b',
  '10': 'ar-k',
  '14': 'ar-x',
  '18': 'ar-w',
  '22': 'ar-h',
  '26': 'ar-u',
  '30': 'ar-e',
  '34': 'ar-p',
  '38': 'ar-y',
  '42': 'ar-l',
  '46': 'ar-f',
  '50': 'ar-m',
  '54': 'ar-n',
  '58': 'ar-q',
  '62': 'ar-r',
  '66': 'ar-a',
  '70': 'ar-j',
  '74': 'ar-d',
  '78': 'ar-z',
  '82': 'ar-s',
  '86': 'ar-g',
  '90': 'ar-t',
  '94': 'ar-v',
};

/** Nombre corto: el oficial de Tierra del Fuego no entra en un chip. */
// CABA: el nombre oficial ("Ciudad Autónoma de Buenos Aires") no entra en un chip.
const LABEL_OVERRIDES = { 'ar-c': 'CABA', 'ar-v': 'Tierra del Fuego' };

const ringArea = (ring) => {
  let area = 0;
  for (let i = 1; i < ring.length; i++) {
    area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  }
  return Math.abs(area) / 2;
};

const inMainland = (ring) =>
  ring.some(
    ([lng, lat]) =>
      lng >= MAINLAND.minLng &&
      lng <= MAINLAND.maxLng &&
      lat >= MAINLAND.minLat &&
      lat <= MAINLAND.maxLat
  );

const round = (ring) => ring.map(([lng, lat]) => [Number(lng.toFixed(4)), Number(lat.toFixed(4))]);

const main = async () => {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`${SOURCE} respondió ${response.status}`);
  const source = await response.json();

  const zones = [];
  let totalPoints = 0;
  let sourcePoints = 0;

  for (const feature of source.features) {
    const id = ISO_BY_INDEC[String(feature.properties.id)];
    if (!id) throw new Error(`Código INDEC sin mapear: ${feature.properties.id}`);

    // Sólo los anillos exteriores; los agujeros no cambian en qué zona cae una
    // sucursal y sí pesan.
    const geometry = feature.geometry;
    const outerRings = (
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    ).map((rings) => rings[0]);
    sourcePoints += outerRings.reduce((total, ring) => total + ring.length, 0);

    const kept = outerRings
      .filter(inMainland)
      .map((ring) => ({ ring, area: ringArea(ring) }))
      .sort((a, b) => b.area - a.area);
    const totalArea = kept.reduce((total, item) => total + item.area, 0);

    const simplified = kept
      .filter((item) => item.area / totalArea >= MIN_AREA_SHARE)
      .slice(0, MAX_POLYGONS_PER_ZONE)
      .map((item) => round(simplifyRing(item.ring, TOLERANCE_M).ring))
      // Un anillo cerrado necesita 4 posiciones; menos que eso no es un área.
      .filter((ring) => ring.length >= 4);

    if (!simplified.length) throw new Error(`${id} quedó sin geometría`);
    totalPoints += simplified.reduce((total, ring) => total + ring.length, 0);

    zones.push({
      id,
      label: LABEL_OVERRIDES[id] ?? feature.properties.nombre,
      coordinates: simplified,
    });
  }

  zones.sort((a, b) => a.label.localeCompare(b.label, 'es'));

  // El índice del backend y este catálogo tienen que nombrar exactamente las
  // mismas zonas: el schema valida los `preset` contra el índice, así que un id
  // que sobre allá se guardaría y después no resolvería a ninguna geometría.
  const key = (zone) => `${zone.id}:${zone.label}`;
  const indexed = GEO_ZONES_AR_INDEX.map(key).sort();
  const built = zones.map(key).sort();
  if (indexed.join('|') !== built.join('|')) {
    throw new Error(
      'geo-zones-ar-index.ts quedó desalineado con el catálogo.\n' +
        `  índice:   ${indexed.join(', ')}\n` +
        `  generado: ${built.join(', ')}`
    );
  }

  const body = zones
    .map(
      (zone) =>
        `  {\n    id: '${zone.id}',\n    label: ${JSON.stringify(zone.label)},\n` +
        `    geometry: {\n      type: 'MultiPolygon',\n      coordinates: ${JSON.stringify(
          zone.coordinates.map((ring) => [ring])
        )},\n    },\n  },`
    )
    .join('\n');

  const file = `import type { StoreLocatorZone } from "@lib/types/store-locator"

/**
 * Catálogo de zonas de Argentina para el filtro de ubicación de /sucursales.
 *
 * GENERADO — no editar a mano. Regenerar con:
 *   cd apps/backend && node --experimental-transform-types \\
 *     --import ./test-register.mjs src/scripts/build-geo-zones-ar.mjs
 *
 * Fuente: ${SOURCE} (Servicio de Normalización de Datos Geográficos, JGM;
 * límites del IGN). Simplificado con Douglas-Peucker a ${TOLERANCE_M} m,
 * sin agujeros y sin las islas fuera del continente + Tierra del Fuego.
 *
 * Ésta es la ÚNICA copia de las geometrías. Una tienda que prende una de estas
 * zonas guarda sólo \`{ preset: 'ar-x' }\` en su \`content_config\`, y el template
 * la resuelve acá en el servidor. Por eso mejorar un polígono beneficia a todas
 * las tiendas sin tocarles la fila — y por eso los ids no se cambian nunca.
 *
 * El índice de ids y nombres está espejado en
 * \`apps/backend/src/lib/geo-zones-ar-index.ts\`, que es lo que usan el schema de
 * validación y la ficha de la tienda.
 */
export const GEO_ZONES_AR: StoreLocatorZone[] = [
${body}
]

export const GEO_ZONES_AR_BY_ID = new Map(GEO_ZONES_AR.map((zone) => [zone.id, zone]))
`;

  writeFileSync(OUT, file, 'utf8');
  console.log(
    `${zones.length} zonas · ${sourcePoints} puntos → ${totalPoints} · ` +
      `${(file.length / 1024).toFixed(0)} KB`
  );
};

await main();
