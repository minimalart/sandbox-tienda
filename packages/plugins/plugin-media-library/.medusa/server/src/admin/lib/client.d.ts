import Medusa from '@medusajs/js-sdk';
/**
 * SDK del backoffice local del plugin. media-library no es multi-tenant, así
 * que este cliente NO propaga headers de site scope; usa la sesión estándar del
 * admin. Si el host tiene su propio cliente con site-scope (multistore),
 * corre en paralelo — cada widget usa el suyo.
 */
export declare const sdk: Medusa;
