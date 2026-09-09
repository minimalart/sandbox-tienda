import { siteColumnFilter, type SiteColumnScope } from '../../lib/multistore/scope';
import type { SiteResolution } from '../../lib/multistore/types';

/**
 * `empty: 'all'` — las corridas anteriores a la columna se ven desde cualquier tienda.
 *
 * Y el `'all'` acá tiene un motivo extra: esconder el historial de enriquecido dejaría
 * sin explicación un producto que cambió. El producto es compartido; el historial de
 * quién lo tocó no puede desaparecer del backoffice que lo está mirando.
 */
export const CATALOGING_EXECUTION_SITE_SCOPE: SiteColumnScope = {
  kind: 'site_column',
  table: 'cataloging_execution',
  column: 'site_id',
  empty: 'all',
};

/**
 * El predicado de tienda del LISTADO, como filtro de ORM y no como subselect.
 *
 * Por qué no `siteFilter`, que es lo que usaba esta ruta: `siteFilter` resuelve la
 * pertenencia con SQL crudo y ese SQL lleva `AND "deleted_at" IS NULL` cableado. Es
 * lo correcto para el listado normal y es EXACTAMENTE lo que rompe la papelera: con
 * el subselect, una corrida borrada no entra en la lista de ids permitidos, así que
 * `?deleted=only` devolvería vacío en toda tienda secundaria — la papelera se vería
 * llena en la principal y vacía en las demás, sin ningún error. Un solo predicado
 * para los dos modos es también un drift menos: el día que cambie quién ve qué, no
 * hay una segunda copia que se olvide.
 *
 * De paso desaparece el tope de `SITE_SCOPE_MAX_IDS` (5000): `siteFilter` TIRA
 * cuando la tabla lo pasa, y `cataloging_execution` crece con cada corrida. Este
 * predicado es una columna, no una lista de ids materializada.
 *
 * OJO con la FORMA, que es la parte no obvia. `siteColumnFilter` de la copia
 * sincronizada de `lib/multistore/scope.ts` todavía devuelve
 * `{ site_id: [id, null] }`, que se traduce a `site_id IN ('x', NULL)` y **nunca
 * matchea `site_id IS NULL`**: las corridas globales —las anteriores a la columna,
 * que `empty: 'all'` promete mostrar— se volverían invisibles. El arreglo existe
 * (`$or` de dos ramas) pero vive sólo en `apps/backend/src/lib/multistore/scope.ts`;
 * las 18 copias de los plugins siguen con el array. Acá se corrige la forma sin
 * tocar el archivo sincronizado, y el `!Array.isArray` deja que este helper siga
 * andando tal cual el día que el `$or` baje a las copias.
 */
export function executionSiteFilter(resolution: SiteResolution): Record<string, unknown> {
  // Se delega en `siteColumnFilter` la decisión de SI hay que filtrar —y el tiro
  // ante `unknownSite`—, para no reimplementar ese criterio por tercera vez.
  const base = siteColumnFilter(resolution, CATALOGING_EXECUTION_SITE_SCOPE);
  const column = CATALOGING_EXECUTION_SITE_SCOPE.column;
  const value = base[column];

  if (value === undefined) return {}; // no hay eje de tienda: no se filtra
  if (!Array.isArray(value)) return base; // ya viene con la forma correcta
  return { $or: value.map((v) => ({ [column]: v })) };
}
