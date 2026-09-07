import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
/**
 * `empty: 'all'` — los comentarios anteriores a la columna se moderan desde cualquier
 * tienda. Esconder reseñas de clientes reales el día del deploy es peor que mostrarlas
 * de más: una reseña sin moderar que nadie ve queda publicada.
 */
export declare const COMMENT_SITE_SCOPE: SiteScopeDescriptor;
