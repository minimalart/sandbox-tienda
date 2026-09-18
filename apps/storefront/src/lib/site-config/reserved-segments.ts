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
 * Segmentos de primer nivel que viven FUERA de `[countryCode]`.
 *
 * `proxy.ts` reescribe toda URL limpia a `/{countryCode}<path>` para que matchee la
 * carpeta `[countryCode]`. Estas rutas no cuelgan de ahí, así que esa reescritura las
 * manda a un path que no existe: `/driver` terminaba en `/ar/driver` y la mini-app del
 * repartidor entera contestaba 404 — sin un error en ningún lado, porque para Next es
 * una URL que simplemente no existe. El proxy las deja pasar sin reescribir.
 *
 * `api` figura acá aunque el proxy la corte varias líneas antes (tiene que reinyectar
 * headers): esta lista describe el ÁRBOL DE RUTAS, no el orden de los ifs.
 *
 * Lo mantiene honesto `reserved-segments.test.ts`, que camina `src/app` sin bajar a
 * `[countryCode]` y falla si aparece una carpeta nueva que el proxy mandaría a la nada.
 *
 * ⚠ LOS CUATRO SE REPITEN LITERALES en la lista ruteable de abajo, en vez de
 * spreadearse en ella, y el nombre de esa constante NO se escribe en este comentario.
 * Los dos detalles son por lo mismo: el espejo del backend
 * (`modules/demo-store/reserved-slugs.test.ts`) lee ESTE ARCHIVO COMO TEXTO y saca los
 * literales del array con una regex —tiene que hacerlo, porque `apps/backend` no puede
 * importar nada de afuera de `apps/backend/`— y esa regex arranca en la PRIMERA
 * aparición del nombre, comentarios incluidos. Con un spread, o con el nombre nombrado
 * más arriba, el espejo ve cuatro slugs MENOS de los que el storefront reserva de
 * verdad, y ahí el backend deja crear una tienda con una URL que nunca resuelve.
 *
 * La duplicación la cubre `reserved-segments.test.ts`, que exige que cada segmento de
 * esta lista siga estando en la lista ruteable.
 */
export const SEGMENTS_OUTSIDE_COUNTRY_CODE: readonly string[] = [
  'api',
  'driver',
  'llms.txt',
  'maintenance',
]

/**
 * Folders ruteables de PRIMER NIVEL del App Router.
 *
 * Lo mantiene honesto `reserved-segments.test.ts`, que camina `src/app` y falla si
 * alguien agrega una página nueva sin agregarla acá. Sin ese guard, alguien mete
 * `(main)/ofertas/` en seis meses y le tapa el sitio al cliente con slug `ofertas`.
 */
export const ROUTABLE_SEGMENTS: readonly string[] = [
  // Fuera de [countryCode] — espejo literal de `SEGMENTS_OUTSIDE_COUNTRY_CODE`
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
  'bundles',
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
