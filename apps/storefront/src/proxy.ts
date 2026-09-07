import { type NextRequest, NextResponse } from 'next/server'
import {
  parseUtmFromSearch,
  buildUtmCookieValue,
  UTM_COOKIE_NAME,
  UTM_COOKIE_MAX_AGE,
} from '@lib/util/utm'
import {
  resolveSite,
  SITE_PATH_SEGMENT,
  SITE_SLUG_COOKIE,
} from '@lib/site-config/resolve-site'

/**
 * Headers de identidad del sitio para los Server Components.
 *
 * `x-site-slug` es el nuevo; `x-demo-slug` se sigue emitiendo UN RELEASE para que
 * nada se rompa a mitad de deploy. No necesita alias permanente (a diferencia de la
 * cookie): el proxy y `active-tenant.ts` viajan en el MISMO artefacto de build de
 * Next, y Vercel sirve un deployment inmutable por request — emisor y lector nunca
 * pueden ser de versiones distintas.
 */
const SITE_SLUG_HEADER = 'x-site-slug'
const LEGACY_SITE_SLUG_HEADER = 'x-demo-slug'
/** Prefijo de path a usar para armar links. `''` bajo resolución por host. */
const SITE_PREFIX_HEADER = 'x-site-prefix'

// Modo mantenimiento: cuando está activo, toda la navegación se reescribe a
// /maintenance y no se puede acceder a ninguna otra URL del sitio.
const MAINTENANCE_MODE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
const MAINTENANCE_PATH = '/maintenance'
const DEFAULT_REGION: string =
  (
    process.env.NEXT_PUBLIC_COUNTRY_CODE ||
    process.env.NEXT_PUBLIC_DEFAULT_REGION ||
    'ar'
  ).toLowerCase()

/**
 * Sets UTM cookie on the response if UTM params are present in the URL
 * and no existing UTM cookie is found (first-touch attribution).
 */
function applyUtmCookie(request: NextRequest, response: NextResponse): void {
  if (request.cookies.has(UTM_COOKIE_NAME)) return

  const utmParams = parseUtmFromSearch(request.nextUrl.search)
  if (!utmParams) return

  utmParams.landing_page = request.nextUrl.pathname
  utmParams.referrer = request.headers.get('referer') || undefined

  response.cookies.set(UTM_COOKIE_NAME, buildUtmCookieValue(utmParams), {
    path: '/',
    maxAge: UTM_COOKIE_MAX_AGE,
    sameSite: 'lax',
  })
}

/**
 * Sesión anónima para atribuir recomendaciones.
 *
 * Se setea acá y no en el cliente porque es la única forma de que un rail renderizado
 * en el SERVIDOR y los beacons que dispara después el CLIENTE compartan la misma
 * sesión: el server component necesita el id al pedir las recomendaciones (es el que
 * produce el `request_id`) y el cliente necesita el mismo id al reportar la vista o el
 * clic. Si cada lado inventara el suyo, el embudo no se podría reconstruir.
 *
 * Sólo se escribe si falta, así no hay churn de cookies en cada request. NO es
 * httpOnly a propósito: el cliente tiene que poder leerla. No lleva dato personal
 * alguno, sólo un identificador aleatorio.
 */
// Ventana en la que volver a /checkout se interpreta como "el comprador apretó
// el botón atrás desde MercadoPago". Más allá de esto la cookie ya no describe
// la navegación actual: describe un pago viejo que nunca se cerró.
const MP_BACK_BUTTON_WINDOW_MS = 15 * 60 * 1000 // 15 min

const REC_SESSION_COOKIE = '_rec_sid'
const REC_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 días

function applyRecommendationSessionCookie(
  request: NextRequest,
  response: NextResponse
): void {
  if (request.cookies.has(REC_SESSION_COOKIE)) return

  response.cookies.set(REC_SESSION_COOKIE, crypto.randomUUID(), {
    path: '/',
    maxAge: REC_SESSION_MAX_AGE,
    sameSite: 'lax',
  })
}

/**
 * Proxy (antes middleware.ts; renombrado por la deprecación de Next 16).
 * Maneja region selection y auth headers.
 *
 * Estrategia de URLs:
 * - La URL visible en el browser NUNCA incluye el countryCode (ej: /cart, /store).
 * - El folder del App Router sigue siendo [countryCode] por compatibilidad interna
 *   (useParams().countryCode y params.countryCode se resuelven al valor del env
 *    NEXT_PUBLIC_COUNTRY_CODE para que Medusa siga funcionando).
 * - Si llega una URL legacy con el prefijo /ar/... se redirige a la versión limpia.
 * - Si llega una URL limpia, se hace rewrite interno para que Next matchee [countryCode].
 */
export default async function proxy(request: NextRequest) {
  // API routes: quedan FUERA del flujo de rewrite/redirect (no se reescriben a
  // /[countryCode] ni se les aplica mantenimiento), pero sí necesitan el
  // contexto del demo. Los fetch client-side del storefront (p.ej. la página
  // Comparar pegándole a /api/store/product?id=...) viajan con la cookie
  // `_demo_slug` pero SIN el header `x-demo-slug` (el proxy normalmente saltea
  // /api). Sin ese header, getActiveSalesChannelId cae al canal default y busca
  // los productos del demo en el catálogo equivocado (resultado vacío). Acá
  // reinyectamos el header desde la cookie para que los handlers server-side
  // resuelvan el sales channel del demo activo.
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Se resuelve con el MISMO resolver que la navegación, no leyendo la cookie a
    // mano. Bajo subdominios la cookie no existe (el host manda y la cookie se
    // ignora), así que un lector de cookie pelado dejaría a todos los fetch de
    // cliente cayendo al catálogo del sitio principal.
    const site = resolveSite(request)
    if (!site.slug) return NextResponse.next()
    const headers = new Headers(request.headers)
    headers.set(SITE_SLUG_HEADER, site.slug)
    // Un release de convivencia: los server components todavía leen el viejo.
    headers.set(LEGACY_SITE_SLUG_HEADER, site.slug)
    headers.set(SITE_PREFIX_HEADER, site.pathPrefix)
    return NextResponse.next({ request: { headers } })
  }

  // Modo mantenimiento: reescribir TODA la navegación a /maintenance.
  // Va primero para que ninguna otra ruta (incluido /checkout) sea accesible.
  // Los assets estáticos (.png, .svg, _next, etc.) ya quedan excluidos por el
  // matcher de abajo, así que la propia página de mantenimiento puede renderizar.
  if (MAINTENANCE_MODE && request.nextUrl.pathname !== MAINTENANCE_PATH) {
    return NextResponse.rewrite(new URL(MAINTENANCE_PATH, request.url))
  }

  // Redirect user back from Mercado Pago via browser back button.
  // The cookie is set client-side before navigating to MP and cleared by the
  // three return screens (success / pending / failure).
  // IMPORTANTE: solo aplicar en navegaciones GET. Los server actions de Next.js hacen POST
  // a la misma URL de la página (/checkout?step=...) y un redirect rompería
  // la respuesta RSC con "An unexpected response was received from the server."
  //
  // La cookie lleva el timestamp del momento en que se salió a MercadoPago y
  // sólo vale por `MP_BACK_BUTTON_WINDOW_MS`. Volver con el botón "atrás" pasa
  // en minutos; el `max-age=3600` de la cookie es apenas el techo del browser.
  // Sin la ventana, un comprador que abandonaba el pago en MercadoPago sin
  // volver por ninguna de las tres pantallas arrastraba la cookie una hora
  // entera, y su próxima visita a /checkout —carrito nuevo, sin ningún pago
  // intentado— aterrizaba en "Pago rechazado". Reportado en QA como un glitch
  // transitorio (BUG-007); era determinista, y parecía transitorio sólo porque
  // /checkout/failure borra la cookie y por eso el reintento andaba.
  //
  // El valor legacy '1' (cookies emitidas antes de este cambio, vivas hasta una
  // hora después del deploy) se trata como vencido a propósito: no tiene
  // timestamp con qué decidir, y errar hacia "no mostrar un rechazo falso" es
  // mucho más barato que errar hacia mostrarlo.
  const mpPaymentPending = request.cookies.get('mp_payment_pending')?.value
  const isCheckoutPath = request.nextUrl.pathname === '/checkout'
  if (mpPaymentPending && request.method === 'GET' && isCheckoutPath) {
    const startedAt = Number(mpPaymentPending)
    const isFresh =
      Number.isFinite(startedAt) &&
      startedAt > 0 &&
      Date.now() - startedAt < MP_BACK_BUTTON_WINDOW_MS
    if (isFresh) {
      return NextResponse.redirect(new URL('/checkout/failure', request.url))
    }
  }

  const cacheIdCookie = request.cookies.get('_medusa_cache_id')
  const cacheId = cacheIdCookie?.value || crypto.randomUUID()

  /**
   * ⚠ CACHE KEYS BAJO MULTI-HOST — leer antes de agregar cualquier caché.
   *
   * El rewrite manda a `/{cc}{subpath}`, y esos paths son IDÉNTICOS entre hosts:
   * `moda.<sufijo>/store` y `zapatos.<sufijo>/store` reescriben los dos a
   * `/ar/store`. Lo único que hoy hace eso seguro es que TODA la superficie sea
   * dinámica.
   *
   * Por eso: **NO agregar `revalidate` ni ISR a ninguna página bajo `[countryCode]`
   * mientras multi-host esté vivo.** Lo hace cumplir
   * `lib/site-config/cache-directives.test.ts`, que permite `revalidate = 0` (es
   * "nunca cachear", un refuerzo) y rechaza cualquier TTL > 0.
   *
   * Y ojo con `experimental.staleTimes.dynamic: 30` en `next.config.js`: es Router
   * Cache del CLIENTE. Navegar client-side entre dos identidades de sitio dentro del
   * mismo árbol de provider podría servir el shell de otro tenant durante 30s. Hoy no
   * se dispara porque cada identidad entra por un full load.
   *
   * INCÓGNITA ABIERTA, a medir en prod: si el CDN de Vercel keyea por `Host`.
   * Probablemente sí (cada dominio es un alias), pero "probablemente" no es criterio
   * de deploy — es lo único que podría servir el sitemap del sitio A en el dominio de
   * B. Se mide comparando dos hosts en caliente (ver el plan, §verificación de prod).
   */
  // Single-region (AR): el countryCode se resuelve directo del env, sin fetch a
  // /store/regions. El region-map dinámico se eliminó a propósito.
  // ASUNCIÓN: single-region permanente (AR). Si se agrega una segunda región, revertir
  // este bloque y restaurar getRegionMap + getCountryCode + ruteo geo-IP
  // (x-vercel-ip-country) y la detección de prefijo legacy por mapa. Hoy todo
  // colapsa a DEFAULT_REGION.
  const effectiveCountryCode = DEFAULT_REGION

  const firstPathSegment = request.nextUrl.pathname.split('/')[1]?.toLowerCase()
  const urlHasLegacyCountryCode = firstPathSegment === DEFAULT_REGION

  // Headers para Server Components: CLONAR los de la request original y agregar
  // el JWT. Si se crea un `new Headers()` vacío, el rewrite REEMPLAZA todos los
  // headers de la request downstream — incluido `Cookie` — y la página SSR lee
  // las cookies vacías (p.ej. _b2b_cart_id → el checkout no encuentra el carrito).
  const authToken = request.cookies.get('_medusa_jwt')?.value

  /**
   * Identidad del sitio: UNA llamada, y se ramifica sobre el resultado.
   *
   * Antes esto eran ~20 líneas de resolución manual acá adentro, entretejida con la
   * forma de la URL. Ahora la decisión vive en `resolveSiteFromParts()`, que es pura
   * y tiene una tabla de tests; el proxy sólo la aplica. Es lo que permite prender
   * los subdominios sin volver a tocar este archivo.
   *
   * El sitio se mantiene navegable COMPLETO (tienda, PDP, carrito, blog…): el blog
   * es una sub-ruta como cualquier otra y tiene que heredar el slug, o
   * `listBlogPosts`/`listBlogCategories` traen los posts del catálogo principal.
   */
  const site = resolveSite(request)

  let requestInit: { request: { headers: Headers } } | undefined
  if (authToken || site.slug) {
    const headers = new Headers(request.headers)
    if (authToken) headers.set('x-medusa-jwt', authToken)
    if (site.slug) {
      headers.set(SITE_SLUG_HEADER, site.slug)
      headers.set(LEGACY_SITE_SLUG_HEADER, site.slug)
      headers.set(SITE_PREFIX_HEADER, site.pathPrefix)
    }
    requestInit = { request: { headers } }
  }

  /**
   * Cookie de sesión del sitio.
   *
   * Sólo se ESCRIBE `_site_slug`; la vieja `_demo_slug` se sigue leyendo un release
   * (ver `readSiteSlugCookie`) y se borra activamente cuando la sesión termina, para
   * que no quede resucitando un sitio viejo.
   *
   * Bajo resolución por HOST no se escribe NADA: el host ya identifica el sitio, y
   * una cookie ahí sólo podría contradecirlo.
   */
  const applySiteCookie = (res: NextResponse): void => {
    if (site.source === 'host') return
    if (site.isExit) {
      res.cookies.set(SITE_SLUG_COOKIE, '', { path: '/', maxAge: 0 })
      res.cookies.set('_demo_slug', '', { path: '/', maxAge: 0 })
    } else if (site.source === 'path' && site.slug) {
      res.cookies.set(SITE_SLUG_COOKIE, site.slug, {
        path: '/',
        maxAge: 60 * 60 * 24,
        sameSite: 'lax',
        httpOnly: true,
      })
    }
  }

  const queryString = request.nextUrl.search || ''

  // NOTE: we deliberately do NOT redirect the main home (`/`) to the demo when a
  // _demo_slug cookie is present. Doing so made the Mercatto home unreachable for
  // anyone who had visited a demo, and turned into a hard 404 whenever that demo
  // wasn't `ready` (deleted / mid-import). The demo home lives at /demo/{slug};
  // `/` always stays the main home (getActiveTenant falls back to the default
  // tenant when the demo config isn't available).

  // 1. Legacy URLs con /ar/... → redirect a la versión limpia sin prefijo.
  if (urlHasLegacyCountryCode) {
    const strippedPath =
      '/' + request.nextUrl.pathname.split('/').slice(2).join('/')
    const cleanPath = strippedPath === '/' ? '/' : strippedPath.replace(/\/$/, '')
    const redirectResponse = NextResponse.redirect(
      new URL(`${cleanPath}${queryString}`, request.url),
      307,
    )
    if (!cacheIdCookie) {
      redirectResponse.cookies.set('_medusa_cache_id', cacheId, {
        maxAge: 60 * 60 * 24,
      })
    }
    applyUtmCookie(request, redirectResponse)
    applyRecommendationSessionCookie(request, redirectResponse)
    return redirectResponse
  }

  // 1b. Forma legacy `/demo/<slug>` → 308 permanente a `/tienda/<slug>`.
  //
  // Sin loop: el redirect es VISIBLE al browser (cambia la URL a /tienda/…), y el
  // rewrite interno de más abajo no lo es. El browser vuelve pidiendo /tienda/… que
  // ya no es legacy.
  //
  // Sólo GET/HEAD: los server actions de Next hacen POST a la URL de la página, y
  // redirigir un POST rompe la respuesta RSC con "An unexpected response was
  // received from the server" (mismo motivo que el guard de MercadoPago de arriba).
  //
  // El 308 NO se borra nunca: `/demo/<slug>` está en links compartidos por mail y
  // WhatsApp, y en URLs indexadas.
  if (
    site.isLegacyPath &&
    site.slug &&
    (request.method === 'GET' || request.method === 'HEAD')
  ) {
    const rest = request.nextUrl.pathname.split('/').slice(3).join('/')
    const target = `/${SITE_PATH_SEGMENT}/${site.slug}${rest ? `/${rest}` : ''}`
    return NextResponse.redirect(new URL(`${target}${queryString}`, request.url), 308)
  }

  // NOTA — acá NO va un 308 al host canónico, y es una decisión de diseño.
  //
  // Cada tienda elige su forma canónica (columna `canonical_form`), así que para
  // saber en qué dirección redirigir el proxy tendría que LEER LA FILA — o sea poner
  // el backend en el camino crítico del TTFB de toda navegación. Es exactamente lo
  // que se descartó al rechazar el slug en la raíz.
  //
  // La canonicalización se hace donde el tenant YA está cargado, sin I/O extra: el
  // `<link rel="canonical">` (`lib/util/site-url.ts`) y el `noindex` de `robots`. El
  // canonical tag es la señal primaria para Google; el 308 era cinturón y tiradores.
  // Bonus: las dos formas quedan alcanzables, así que un link compartido a
  // /tienda/<slug> sigue funcionando en vez de rebotar.

  // 2. Static assets: passthrough sin rewrite.
  if (request.nextUrl.pathname.includes('.')) {
    return NextResponse.next(requestInit)
  }

  // 3. URL limpia → rewrite interno a /<countryCode>/<path> para que Next matchee [countryCode].
  // Demo Stores: el slug vive en la URL durante TODA la navegación del demo
  // (/demo/{slug}/store, /demo/{slug}/products/x…). El home (/demo/{slug}) usa la
  // página real demo/[slug]/page.tsx; en las sub-rutas stripeamos el prefijo
  // /demo/{slug} para reusar las rutas existentes (store, cart, products…) con el
  // header x-demo-slug ya seteado. La cookie _demo_slug queda como red de
  // seguridad para cualquier link que aún no lleve el prefijo.
  // `site.rewritePath` YA resolvió las tres formas: home de sitio (reconstruida
  // explícitamente al folder real `/demo/<slug>`), sub-ruta (con el prefijo
  // stripeado para reusar las rutas existentes) y sitio principal (sin tocar).
  //
  // ⚠ Reconstruir la home explícitamente es la línea más importante del bloque. El
  // código viejo pasaba `pathname` derecho y funcionaba de casualidad, porque la URL
  // pública YA era `/demo/<slug>`; con `/tienda/<slug>` eso produciría
  // `/{cc}/tienda/<slug>` → 404, porque la carpeta sigue siendo `(main)/demo/[slug]`.
  const pathForRewrite = site.rewritePath === '/' ? '' : site.rewritePath
  const rewriteUrl = new URL(
    `/${effectiveCountryCode}${pathForRewrite}${queryString}`,
    request.url,
  )
  const response = NextResponse.rewrite(rewriteUrl, requestInit)
  if (!cacheIdCookie) {
    response.cookies.set('_medusa_cache_id', cacheId, {
      maxAge: 60 * 60 * 24,
    })
  }
  applyUtmCookie(request, response)
  applyRecommendationSessionCookie(request, response)
  applySiteCookie(response)
  return response
}

export const config = {
  matcher: [
    // NOTE: /api ya NO se excluye acá — el proxy lo intercepta arriba para
    // reinyectar `x-demo-slug` desde la cookie y hace early-return (sin rewrite).
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|llms.txt|opengraph-image|twitter-image|icon|apple-icon|images|assets|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)',
  ],
}
