/**
 * Núcleo PURO de la resolución de la base pública del storefront.
 *
 * Vive separado del handler por el mismo motivo que
 * `admin/routes/sites/lib.ts`: acá se decide a qué DOMINIO apunta cada link
 * público que muestra el admin, y esa decisión tiene que poder ejercitarse en un
 * test sin levantar Medusa, sin contenedor y sin tocar `process.env`. Todo entra
 * por parámetro.
 *
 * Que esto haya sido código suelto adentro del handler no es anecdótico: el bug
 * que originó toda esta ruta —el listado de una instalación linkeando al dominio
 * de OTRA marca— vivió meses porque la base se resolvía en un lugar que nadie
 * podía observar. La lógica que elige un dominio se testea.
 */

/**
 * Último recurso. Localhost a propósito y NUNCA el dominio de una instalación
 * concreta: un link a localhost se ve roto y se reporta; uno al dominio de otra
 * marca se ve bien y se reporta como otro bug, seis meses después.
 */
export const LOCAL_FALLBACK = 'http://localhost:3000';

const isLocal = (u: string): boolean =>
  /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u);

// Dominios que NUNCA son el storefront, aunque aparezcan en STORE_CORS
// (placeholders típicos de los starters de Medusa, ej. docs.medusajs.com).
const isNonStorefront = (u: string): boolean => /medusajs\.com/i.test(u);

const withoutTrailingSlash = (raw: string): string => raw.replace(/\/+$/, '');

/**
 * El origin del storefront que se puede adivinar de `STORE_CORS`.
 *
 * Prefiere uno público (no-localhost, no-medusajs) y con `https`, porque el
 * PRIMERO de la lista suele ser localhost o un placeholder del starter en configs
 * mixtas. Si no hay ninguno público se devuelve el primero igual: en una
 * instalación de desarrollo eso es exactamente lo que corresponde.
 */
export const storefrontOriginFromCors = (storeCors: string | undefined): string | undefined => {
  const origins = (storeCors || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const publicOrigins = origins.filter((o) => !isLocal(o) && !isNonStorefront(o));

  return (
    publicOrigins.find((o) => o.startsWith('https://')) ||
    publicOrigins[0] ||
    origins[0]
  );
};

/**
 * La base de la INSTANCIA, ya normalizada (sin barra final).
 *
 * `configured` es lo que resolvió `app-settings` para
 * `MULTISTORE_PUBLIC_BASE_URL` —fila de la base, si no esa env, si no
 * `STOREFRONT_URL`— y llega ya como string, `''` cuando no hay nada. Que sea un
 * parámetro y no una lectura de acá adentro es lo que hace la precedencia
 * observable: el test le pasa `''` y verifica que una instalación que no tocó la
 * card se comporta EXACTAMENTE como antes de que la card existiera.
 */
export const pickStorefrontBase = (
  configured: string,
  storeCors: string | undefined,
): string =>
  withoutTrailingSlash(
    configured.trim() || storefrontOriginFromCors(storeCors) || LOCAL_FALLBACK,
  );
