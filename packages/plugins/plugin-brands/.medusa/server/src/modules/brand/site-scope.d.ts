import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
/**
 * Cómo una marca declara a qué tiendas pertenece.
 *
 * Vive al lado del modelo y no en la ruta a propósito: la forma física es una
 * propiedad de la tabla, y si cada ruta la repitiera, migrar el modelo obligaría a
 * cazar todas las copias.
 *
 * `empty: 'all'` es la semántica que el storefront ya aplica (ver el comentario de
 * `api/store/brands/route.ts`): `sales_channel_ids` vacío o `NULL` significa "visible
 * en todas las tiendas", NO "de nadie". Cambiarlo a `'unassigned'` escondería todas
 * las marcas globales del listado.
 */
export declare const BRAND_SITE_SCOPE: SiteScopeDescriptor;
