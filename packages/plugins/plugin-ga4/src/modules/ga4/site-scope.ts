import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * `empty: 'all'` en las dos: la fila sin tienda es el mapeo GLOBAL, el que se aplica a
 * toda tienda que no defina el suyo.
 *
 * No es "sin asignar": esconderla del listado haría que el operador viera eventos
 * llegando a GA4 con un nombre que no aparece en ninguna parte de su backoffice.
 */
export const GA4_EVENT_MAPPING_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'ga4_event_mapping',
  column: 'site_id',
  empty: 'all',
};

export const GA4_BUILTIN_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'ga4_builtin_setting',
  column: 'site_id',
  empty: 'all',
};
