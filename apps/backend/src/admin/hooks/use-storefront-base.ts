import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../lib/http';

/**
 * La base pública del storefront de ESTA instalación, resuelta en RUNTIME.
 *
 * ── Por qué no sale del build ────────────────────────────────────────────────────
 *
 * El bundle del admin se compila UNA vez como template y se despliega en cada
 * instalación con su propio dominio, así que en build no hay forma de saber cuál es.
 * `VITE_STOREFRONT_URL` parece la respuesta y no lo es: se inyecta en build, y el
 * Dockerfile de despliegue no recibe build args `VITE_*`, así que en producción llega
 * vacía y el código cae al literal que tenga escrito el template — el dominio de otra
 * marca—. El listado de tiendas linkeaba así durante meses: un `href` que se ve bien y
 * abre la tienda de otro cliente. Se parcheó dos veces cambiando el literal en el repo
 * del cliente y el sync del template lo revirtió las dos, porque el literal es del
 * template y el dominio es del cliente. No hay literal que sirva. Por eso: runtime.
 *
 * ── Por qué vive acá y no en `hooks/api/` ────────────────────────────────────────
 *
 * Lo consumen pantallas de la extensión de tiendas, que es `required`. Ponerlo en
 * `hooks/api/store-config.tsx` las haría importar código de una extensión OPCIONAL,
 * y `project-composer` se la saca a los proyectos que no la eligen: el modo de falla
 * es `next build` rojo en el repo del cliente, no acá. Misma razón por la que
 * `use-active-site.ts` lee el manifest core en vez del hook de tiendas.
 *
 * La RUTA, en cambio, sigue siendo de `store-config` —ahí nació, y de ahí la consumen
 * los previews de blog y de landings—. Sin esa extensión instalada esto responde 404 y
 * queda el fallback, que es exactamente lo que pasaba antes de este hook. Deuda
 * conocida y acotada: la resolución de la URL pública es un dato de la INSTANCIA
 * viviendo en una extensión opcional.
 */

type StorefrontUrlResponse = {
  /** URL de la TIENDA ACTIVA: `<base>/tienda/<slug>` si no es la principal. */
  url: string;
  /** Base de la INSTANCIA, sin prefijo de tienda. */
  base: string;
  hostSuffix?: string;
  sitesBase?: string;
};

export const STOREFRONT_URL_QUERY_KEY = ['store-config', 'storefront-url'] as const;

/**
 * Fallback mientras la query no resolvió, o si la ruta no está.
 *
 * `VITE_STOREFRONT_URL` si el build la recibió, y si no LOCALHOST — nunca el dominio
 * de una instalación concreta, que es el error que este archivo existe para no volver
 * a cometer. La diferencia importa: un link a localhost se ve roto y no engaña a
 * nadie; uno al dominio de otra marca se ve bien y se reporta como otro bug.
 */
const buildTimeFallback = (): string => {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_STOREFRONT_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
};

/**
 * Sólo la BASE de la instancia, lista para pasarle a `buildPublicUrlFrom`.
 *
 * `base`, NO `url`: `url` es la tienda ACTIVA, y las pantallas que arman la URL de una
 * tienda que eligen ellas (el listado elige la FILA, el editor de home el `[id]`) le
 * agregan su propio prefijo. Con `url` el link queda `/tienda/activa/tienda/elegida`,
 * que es un 404.
 */
export function useStorefrontOrigins() {
  const { data } = useQuery({
    queryKey: STOREFRONT_URL_QUERY_KEY,
    queryFn: () => fetchJson<StorefrontUrlResponse>('/admin/store-config/storefront-url'),
    // Sale de variables de entorno del proceso: no cambia mientras la pestaña viva.
    staleTime: 30_000,
    retry: false,
  });

  const base = data?.base?.replace(/\/+$/, '') || buildTimeFallback();
  return { base, sitesBase: data?.sitesBase || base, hostSuffix: data?.hostSuffix || '' };
}

export function useStorefrontBase(): string {
  return useStorefrontOrigins().base;
}
