import type { SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tienda pertenece una empresa.
 *
 * `sales_channel_id` es el canal MAYORISTA al que van sus compras, y se asigna al
 * registrarla (`api/store/companies/register` lo toma de `B2B_SALES_CHANNEL_ID`).
 * Como `SiteRef.channel_ids` incluye el `b2b_sales_channel_id` de la tienda, filtrar
 * por él matchea correctamente — eso es justamente el bug B2B ya arreglado.
 *
 * `empty: 'all'` y NO `'unassigned'`, a propósito: las empresas creadas antes de que
 * existiera la columna tienen `NULL`, y esconderlas del listado sería una regresión
 * visible el día del deploy. Cuando se backfillee el canal de las viejas, esto se
 * puede endurecer a `'unassigned'` — y ahí sí una empresa sin tienda no la ve nadie.
 */
export const COMPANY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'company',
  column: 'sales_channel_id',
  empty: 'all',
};
