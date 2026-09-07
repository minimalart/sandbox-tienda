/**
 * Segmentos que NO pueden ser el slug de una tienda.
 *
 * Un slug se resuelve de dos formas y tiene que ser legal en las dos o en ninguna:
 *   - path       `/tienda/<slug>` → colisiona con los segmentos ruteables de acá
 *   - subdominio `<slug>.<sufijo>` → colisiona con los subdominios de la infra
 *
 * ⚠ SE SHIPEA COMO UNIÓN CONSERVADORA, A PROPÓSITO. Ampliar esta lista DESPUÉS de
 * que existan tiendas es BREAKING: un slug vivo pasaría a ser ilegal, y bajo
 * subdominios eso es peor que un 404 — el host viejo pasa a "desconocido" y sirve 200
 * con el contenido del sitio principal. Prohibir de más hoy cuesta un puñado de
 * palabras que nadie quiere.
 *
 * ESPEJO de `apps/backend/src/modules/demo-store/reserved-slugs.ts`. La duplicación
 * es deliberada: `apps/backend` no puede depender en runtime de nada fuera de
 * `apps/backend/`. Cada app tiene su test.
 */

/**
 * Folders ruteables de PRIMER NIVEL del App Router.
 *
 * Lo mantiene honesto `reserved-segments.test.ts`, que camina `src/app` y falla si
 * alguien agrega una página nueva sin agregarla acá. Sin ese guard, alguien mete
 * `(main)/ofertas/` en seis meses y le tapa el sitio al cliente con slug `ofertas`.
 */
export const ROUTABLE_SEGMENTS: readonly string[] = [
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
  // Contenido de primer nivel de los route groups (b2b) (catalogo) (checkout) (splash)
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
  // El prefijo público. `demo` queda arriba porque la forma vieja sobrevive con un
  // 308 permanente, así que tampoco puede ser un slug.
  'tienda',
  // Plural: NO es un segmento ruteable, pero se reserva igual. Ampliar esta lista
  // después de que existan tiendas es breaking (un slug vivo pasaría a ser ilegal),
  // así que se paga ahora, que es gratis.
  'tiendas',
]

/**
 * Labels de subdominio que nunca son una tienda. Cubre los dos caminos de DNS que
 * quedaron abiertos (apex vs subdominio delegado): si el wildcard cuelga del apex,
 * todo subdominio corporativo cae dentro del namespace de tenants.
 */
export const RESERVED_SUBDOMAINS: readonly string[] = [
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
]

/** Nombres de la fila principal: nunca los toma una tienda creada por el usuario. */
export const RESERVED_MAIN: readonly string[] = ['principal', 'main']

export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  ...ROUTABLE_SEGMENTS,
  ...RESERVED_SUBDOMAINS,
  ...RESERVED_MAIN,
])

/**
 * Largo mínimo 3, NO 1: un slug de 2 caracteres choca con el prefijo legacy de país
 * (`/ar/...`, que el proxy sigue redirigiendo) y con el strip de 2 letras que había
 * en `stripDemoPrefix`. Un slug `bo` rompía el highlighting de links en silencio.
 */
export const SLUG_MIN_LENGTH = 3
export const SLUG_MAX_LENGTH = 40
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Un candidato es un slug POSIBLE (forma + largo + no reservado). */
export function isValidSlugShape(candidate: string | null | undefined): boolean {
  if (!candidate) return false
  if (candidate.length < SLUG_MIN_LENGTH || candidate.length > SLUG_MAX_LENGTH) return false
  if (!SLUG_PATTERN.test(candidate)) return false
  return !RESERVED_SEGMENTS.has(candidate)
}
