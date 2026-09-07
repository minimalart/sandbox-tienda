import type { SiteColumnScope, SiteScopeDescriptor } from '../../lib/multistore';
/**
 * A qué tiendas aplica un beneficio de pago. Ver `modules/brand/site-scope.ts` para
 * el porqué de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'` lo declara el propio modelo: "vacío = todos".
 */
export declare const PAYMENT_BENEFIT_SITE_SCOPE: SiteScopeDescriptor;
/**
 * `empty: 'all'` — el catálogo sin tienda es el GLOBAL, sincronizado con las
 * credenciales de entorno. Es el que usa toda tienda que no tenga cuenta propia, así
 * que esconderlo la dejaría sin ningún medio de pago listado.
 */
export declare const PAYMENT_METHOD_CATALOG_SITE_SCOPE: SiteColumnScope;
