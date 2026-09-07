import type { SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tiendas atiende una sucursal. Ver `modules/brand/site-scope.ts` para el
 * porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'`: una sucursal sin canales declarados atiende a todas las tiendas,
 * que es como la trata el storefront hoy.
 */
export const STORE_LOCATION_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'store_location',
  column: 'sales_channel_ids',
  empty: 'all',
};

/**
 * La cobertura hereda la tienda de su sucursal: `branch_coverage` no tiene eje propio.
 *
 * Vivió inline en DOS rutas a la vez —`admin/delivery/coverages-overview` (listado del
 * mapa) y `admin/store-locations/:id/coverage/:coverageId` (guard de edición y borrado)—
 * porque quien las escribió no podía tocar los módulos. La primera se anotó a sí misma
 * "si aparece una segunda, va a `modules/store-location/site-scope.ts`"; apareció, y esto
 * es esa mudanza. Las dos copias eran idénticas campo por campo, así que unificarlas no
 * cambió qué filas ve nadie — pero el riesgo que cierra no era el de hoy sino el de la
 * tercera ruta, que iba a copiar la que tuviera más a mano.
 *
 * `empty: 'all'` por dos razones que apuntan al mismo lado:
 *  - una cobertura sin sucursal es geometría suelta, se ve desde todas, igual que la
 *    sucursal sin canales declarados;
 *  - y el listado y el detalle tienen que coincidir. Con `'unassigned'` acá, una cobertura
 *    que el operador VE en su mapa le devolvería 404 al editarla, que es exactamente la
 *    discrepancia entre listado y detalle que `assertIdInSite` existe para no tener.
 */
export const BRANCH_COVERAGE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'branch_coverage',
  fk: 'store_location_id',
  parent: STORE_LOCATION_SITE_SCOPE,
  empty: 'all',
};
