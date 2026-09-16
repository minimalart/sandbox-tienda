import { z } from 'zod';
import { GEO_ZONE_AR_IDS } from './geo-zones-ar-index';
import { MAX_BRANCH_TYPES, branchTypeSchema } from './branch-types';

const position = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const ring = z
  .array(position)
  .min(4)
  .max(10000)
  .refine((points) => {
    const first = points[0],
      last = points[points.length - 1];
    return !!first && !!last && first[0] === last[0] && first[1] === last[1];
  }, 'El anillo debe estar cerrado: la primera y la última coordenada deben coincidir.')
  .refine((points) => {
    let area = 0;
    for (let i = 1; i < points.length; i++)
      area += points[i - 1]![0] * points[i]![1] - points[i]![0] * points[i - 1]![1];
    return Math.abs(area) > 1e-12;
  }, 'El polígono debe tener superficie.');
const polygon = z.array(ring).min(1).max(100);

const zoneBase = {
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(120),
  /**
   * Sólo tiene sentido en las zonas propias: apagarlas conserva el polígono que
   * alguien dibujó. Un preset apagado directamente no está en la lista — no hay
   * nada que conservar, la geometría vive en el catálogo.
   */
  active: z.boolean().optional(),
};

const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: polygon }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(polygon).min(1).max(100),
  }),
]);

/**
 * Una zona del filtro "Ubicación" del store locator. Dos formas:
 *
 *  - `preset`: una jurisdicción del catálogo de Argentina, guardada por
 *    REFERENCIA. El `content_config` se manda entero en cada guardado de la
 *    ficha de la tienda y el POST del admin corta arriba de ~100 KB: 24
 *    polígonos inline lo romperían. Además, si mañana mejoramos los polígonos
 *    las tiendas se benefician sin tocar su fila.
 *  - `geometry`: una zona dibujada a mano en el mapa (o importada de un
 *    `.geojson`), que sólo existe en esta tienda.
 */
export const storeLocatorZoneSchema = z.union([
  z.object({
    ...zoneBase,
    preset: z
      .string()
      .trim()
      .refine((id) => GEO_ZONE_AR_IDS.has(id), 'Zona del catálogo desconocida.'),
  }),
  z.object({ ...zoneBase, geometry: geometrySchema }),
]);

export type StoreLocatorZoneConfig = z.infer<typeof storeLocatorZoneSchema>;

export const storeLocatorRegionsSchema = z
  .array(storeLocatorZoneSchema)
  .max(100)
  .refine(
    (zones) => new Set(zones.map((zone) => zone.id)).size === zones.length,
    'Los identificadores de zona deben ser únicos.'
  );

/**
 * Los tipos de sucursal de la tienda. Reemplaza a `storeLocatorCategoriesSchema`,
 * que estaba atado a un `z.enum` de tres valores y a un `.max(3)`.
 *
 * Una lista VACÍA es válida y significativa: la tienda no clasifica sus
 * sucursales. Es distinto de que la clave no esté, que significa "todavía no se
 * configuró" y cae en los tres tipos de siempre (ver `resolveBranchTypes`).
 */
export const storeLocatorTypesSchema = z
  .array(branchTypeSchema)
  .max(MAX_BRANCH_TYPES)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    'Los tipos de sucursal no deben repetirse.'
  );

/**
 * Clave vieja del filtro por categoría. Ya no se escribe: la ficha de la tienda
 * emite `types`. Se sigue validando para no rechazar el `content_config` de un
 * sitio que todavía no se guardó con la pantalla nueva.
 */
export const storeLocatorCategoriesSchema = z
  .array(
    z.object({
      type: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(120),
    })
  )
  .max(MAX_BRANCH_TYPES)
  .refine(
    (items) => new Set(items.map((item) => item.type)).size === items.length,
    'Las categorías no deben repetirse.'
  );

export function parseStoreLocatorRegions(value: string) {
  try {
    return storeLocatorRegionsSchema.parse(JSON.parse(value || '[]'));
  } catch {
    throw new Error(
      'Revisá las zonas: usá una lista con id, label y geometry GeoJSON Polygon o MultiPolygon, con coordenadas [longitud, latitud] y anillos cerrados.'
    );
  }
}
