import type { SiteScopeDescriptor } from '../../lib/multistore';
/**
 * A qué tiendas pertenece un look. Ver `modules/brand/site-scope.ts` (host) para
 * el porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'` es la semántica que ya documenta el propio modelo: "null o array
 * vacío = visible en todas".
 */
export declare const SHOP_BY_LOOK_SITE_SCOPE: SiteScopeDescriptor;
