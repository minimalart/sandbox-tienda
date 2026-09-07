import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
/**
 * `empty: 'all'` — las corridas anteriores a la columna se ven desde cualquier tienda.
 *
 * Y el `'all'` acá tiene un motivo extra: esconder el historial de enriquecido dejaría
 * sin explicación un producto que cambió. El producto es compartido; el historial de
 * quién lo tocó no puede desaparecer del backoffice que lo está mirando.
 */
export declare const CATALOGING_EXECUTION_SITE_SCOPE: SiteScopeDescriptor;
