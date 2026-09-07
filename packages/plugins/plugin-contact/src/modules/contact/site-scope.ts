import type { SiteScopeDescriptor } from '@minimalart/mercatto-multistore-contract';

/**
 * Los mensajes de contacto son la PRIMERA tabla que se scopea por `site_id`
 * propio en vez de por canal.
 *
 * Es la forma correcta y acá se puede usar porque la fila nace de una request
 * del storefront, donde la tienda se conoce con certeza (la publishable key
 * trae su canal). En las tablas de contenido curado a mano no se podía: sus
 * filas ya existían sin ningún eje, y backfillearlas habría sido inventar.
 *
 * `empty: 'all'` es TRANSITORIO. Un mensaje pertenece a UNA tienda —la que
 * mostró el formulario—, así que la semántica final es `'unassigned'`. Los
 * mensajes anteriores a la columna quedan en `NULL` y esconderlos el día del
 * deploy sería perder consultas de clientes reales. Se endurece cuando no
 * queden filas sin asignar.
 */
export const CONTACT_SUBMISSION_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'contact_submission',
  column: 'site_id',
  empty: 'all',
};
