import type { SiteScopeDescriptor } from '../../lib/multistore';

/**
 * A qué tienda pertenece cada suscripción.
 *
 * `empty: 'unassigned'` y NO `'all'`, al revés que contacto y empresas. La
 * diferencia no es de criterio, es de historia: esas dos tablas ya existían
 * cuando les agregaron la columna, y sus filas viejas quedaron en `NULL` — para
 * ellas `'all'` es el mal menor mientras no haya backfill.
 *
 * `newsletter_subscription` nace con la columna. Toda fila con `site_id NULL` es
 * una donde la publishable key no resolvió tienda, o sea una anomalía: mostrarla
 * en TODAS las tiendas repartiría contactos de nadie entre todos los operadores.
 * Ocultarla es lo correcto — y la pantalla lo dice explícitamente cuando el
 * contador global no coincide con lo listado.
 */
export const NEWSLETTER_SUBSCRIPTION_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'newsletter_subscription',
  column: 'site_id',
  empty: 'unassigned',
};
