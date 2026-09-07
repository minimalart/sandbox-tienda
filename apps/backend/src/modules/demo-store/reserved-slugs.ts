/**
 * Slugs que una tienda NO puede tomar.
 *
 * Un slug se resuelve de DOS formas, y tiene que ser legal en las dos o en
 * ninguna:
 *   - path      `/{prefijo}/<slug>` → colisiona con los segmentos ruteables del
 *                storefront
 *   - subdominio `<slug>.<sufijo>`  → colisiona con los subdominios de la infra
 *
 * ⚠ ESTA LISTA SE SHIPEA COMO UNIÓN CONSERVADORA, A PROPÓSITO.
 * Ampliarla DESPUÉS de que existan tiendas es BREAKING: un slug vivo pasaría a ser
 * ilegal, y bajo subdominios eso es peor que un 404 — el host viejo pasa a
 * "desconocido" y sirve 200 con el contenido del sitio principal. Prohibir de más
 * hoy cuesta un puñado de palabras que nadie quiere; prohibir de menos cuesta una
 * migración de URLs indexadas.
 *
 * ESPEJO de `apps/storefront/src/lib/site-config/reserved-segments.ts`. La
 * duplicación es deliberada: `apps/backend` no puede depender en runtime de nada
 * fuera de `apps/backend/` (no declara deps `@repo/*` y su tsconfig no tiene
 * `paths`). Cada app tiene su test.
 */

/**
 * Segmentos ruteables de primer nivel del storefront. Si alguien agrega una página
 * nueva y no la agrega acá, un slug podría taparle el sitio a un cliente. Lo hace
 * cumplir el walker de `reserved-segments.test.ts` en el storefront.
 */
const ROUTABLE_SEGMENTS = [
  // Fuera de [countryCode]
  'api',
  'driver',
  'llms.txt',
  'maintenance',
  // Directos bajo [countryCode]
  'c',
  'google-callback',
  'reset-password',
  'validar-entrega',
  // Route groups (b2b) (catalogo) (checkout) (splash)
  'b2b',
  'catalogo',
  'checkout',
  'splash',
  // (main)
  'about',
  'account',
  'blog',
  'cart',
  'categories',
  'collections',
  'colores',
  'comparar',
  'contact',
  'corporate',
  'demo',
  'espacios',
  'gift-card',
  'l',
  'legal',
  'lista-de-compras',
  'not-found',
  'order',
  'products',
  'store',
  'subscriptions',
  'sucursales',
  // El prefijo público. `demo` queda arriba: la forma vieja sigue viva con un
  // 308 permanente, así que tampoco puede ser un slug.
  'tienda',
  // Plural: NO es un segmento ruteable, pero se reserva igual. Ampliar esta lista
  // después de que existan tiendas es breaking (un slug vivo pasaría a ser ilegal),
  // así que se paga ahora, que es gratis.
  'tiendas',
];

/**
 * Labels de subdominio que no pueden ser una tienda. Cubre los dos caminos de DNS
 * que quedaron abiertos (apex vs subdominio delegado): si el wildcard termina
 * colgando del apex, todo subdominio corporativo cae dentro del namespace de
 * tenants, así que se reservan de una.
 */
const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'admin',
  'staging',
  'preview',
  'assets',
  'static',
  'cdn',
  'mail',
  'status',
  'crm',
  'docs',
  '_vercel',
];

/** Nombres de la fila principal: nunca los toma una tienda creada por el usuario. */
const RESERVED_MAIN = ['principal', 'main'];

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...ROUTABLE_SEGMENTS,
  ...RESERVED_SUBDOMAINS,
  ...RESERVED_MAIN,
]);

/** Sólo para los tests y los mensajes de error. */
export const RESERVED_SLUG_LIST: readonly string[] = [...RESERVED_SLUGS].sort();

/**
 * Largo mínimo 3, NO 1.
 *
 * Un slug de 2 caracteres choca con dos cosas: el prefijo legacy de país
 * (`/ar/...`, que el proxy sigue redirigiendo) y el strip de 2 letras de
 * `stripSitePrefix`. Un slug `bo` rompería el highlighting de links en silencio.
 */
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 40;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
