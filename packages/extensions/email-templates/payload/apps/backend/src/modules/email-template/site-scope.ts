import type { SiteColumnScope } from '../../lib/multistore/scope';

/**
 * `empty: 'all'` — la plantilla `NULL` es la GLOBAL y se ve desde todas las tiendas.
 *
 * No es lo mismo que "sin asignar": es la que efectivamente se usa cuando la tienda no
 * tiene la suya, así que esconderla del listado haría que el operador viera un mail
 * salir con un texto que no aparece en ninguna parte de su backoffice.
 *
 * Tipado como `SiteColumnScope` y no como `SiteScopeDescriptor` a secas: es lo que
 * `siteColumnFilter` y `assertWritableSiteId` exigen, y anotarlo con el tipo ancho hace
 * que el compilador los rechace aunque el `kind` sea el correcto. La forma no es un
 * detalle interno — es la que decide qué helpers aplican.
 */
export const EMAIL_TEMPLATE_SITE_SCOPE: SiteColumnScope = {
  kind: 'site_column',
  table: 'email_template',
  column: 'site_id',
  empty: 'all',
};
