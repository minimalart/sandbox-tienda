import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * A qué tiendas se muestra un video. Ver `modules/brand/site-scope.ts` para el porqué
 * de tener el descriptor al lado del modelo.
 *
 * `empty: 'all'`: un video sin canales declarados se ve en todas las tiendas, que es
 * como lo trata el storefront hoy.
 */
export const VIMEO_VIDEO_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_array',
  table: 'vimeo_video',
  column: 'sales_channel_ids',
  empty: 'all',
};
