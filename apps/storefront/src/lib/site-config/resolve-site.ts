// `import type` a propósito: se borra en runtime, así que este módulo NO arrastra
// `next/server` y se puede testear con `node --test`.
import type { NextRequest } from "next/server"
import { isValidSlugShape, RESERVED_SUBDOMAINS } from "./reserved-segments"

/**
 * Resolución de la identidad del SITIO para una request.
 *
 * Esto existe para desacoplar "qué sitio es" de "qué forma tiene la URL". Antes las
 * dos cosas estaban entretejidas dentro de `proxy.ts`, así que agregar los
 * subdominios habría significado reescribir todos los call sites que arman links.
 *
 * Módulo NEUTRO: sin `server-only` (lo importa `proxy.ts`) y sin imports de runtime
 * de Next. La lógica vive en `resolveSiteFromParts()`, que es PURA y SYNC; el
 * adaptador `resolveSite(request)` son tres líneas.
 *
 * SYNC, no async, a propósito: la única rama que necesitaría I/O es el lookup de
 * dominio propio (diferido). Hacerla `async` "por si acaso" pondría un `await` en el
 * camino caliente del proxy, que corre en TODA navegación.
 */

/** Prefijo público canónico. `demo` sobrevive sólo como origen de un 308. */
export const SITE_PATH_SEGMENT = "tienda"
export const LEGACY_SITE_PATH_SEGMENT = "demo"

/**
 * Carpeta REAL de la ruta de la home de un sitio en el App Router:
 * `app/[countryCode]/(main)/demo/[slug]/page.tsx`.
 *
 * Deliberadamente NO se renombra junto con la URL pública. Es lo que mantiene chico
 * este cambio y estables las cache keys de Next: lo que se mueve es la URL visible,
 * el archivo se queda.
 */
export const SITE_HOME_ROUTE_SEGMENT = "demo"

export type SiteSource = "host" | "path" | "cookie" | "none"

export type SiteResolution = {
  /** El slug del sitio activo, o null si es el sitio principal. */
  slug: string | null
  source: SiteSource
  /**
   * Prefijo a poner delante de los links internos. `''` cuando el sitio se resolvió
   * por HOST (el host ya lo dice todo) o cuando es el principal.
   *
   * Es el mecanismo por el que los ~34 call sites de `withSitePrefix()` se vuelven
   * no-op GRATIS el día que se prenden los subdominios: el prefijo pasa a ser dato.
   */
  pathPrefix: string
  /**
   * Path interno al que reescribir, SIN el `/{countryCode}`.
   *
   * ⚠ Acá vive la corrección más importante del bloque. El proxy viejo reescribía
   * `basePath = subpathStripeado ?? pathname`, y la home de un sitio caía en
   * `/{cc}/demo/{slug}` **por accidente**: `pathname` YA era `/demo/{slug}`. Con la
   * URL pública en `/tienda/{slug}` ese passthrough produciría
   * `/{cc}/tienda/{slug}` → 404, porque la carpeta de ruta sigue siendo
   * `(main)/demo/[slug]`. Por eso la home se reconstruye EXPLÍCITAMENTE.
   */
  rewritePath: string
  /** La URL entró con la forma legacy `/demo/<slug>` → hay que 308ear. */
  isLegacyPath: boolean
  /** Esta request termina la sesión de sitio (la home raíz o un `?exit_*`). */
  isExit: boolean
}

export type SiteResolutionParts = {
  /** Host normalizado o crudo; se normaliza acá. */
  host?: string | null
  pathname: string
  cookieSlug?: string | null
  /** `?exit_site` o `?exit_demo` presentes en la query. */
  exitRequested?: boolean
}

/**
 * Normaliza un `Host` para compararlo: minúsculas, sin puerto, sin punto final.
 * Exportada porque las rutas que el matcher del proxy EXCLUYE
 * (`robots`, `sitemap`, `llms.txt`, las OG images) tienen que leer el host solas.
 */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null
  const trimmed = host.trim().toLowerCase()
  if (!trimmed) return null
  // Se corta el puerto sólo si es realmente un puerto (`:8080`), para no romper IPv6.
  const withoutPort = trimmed.replace(/:\d+$/, "")
  const withoutTrailingDot = withoutPort.replace(/\.$/, "")
  return withoutTrailingDot || null
}

/**
 * Slug del sitio a partir del host.
 *
 * STUB HASTA LA FASE 6, y es intencional: hoy devuelve `null` siempre, así que toda
 * la rama `source: 'host'` del resolver queda escrita y testeada pero inactiva. Eso
 * es lo que permite shipear la forma con path ahora y prender los subdominios
 * después con una env var, sin coordinar dos deploys no atómicos.
 *
 * La Fase 6 la completa con aritmética de strings y CERO I/O: si el host termina con
 * `NEXT_PUBLIC_SITE_HOST_SUFFIX` y el primer label es un slug válido y no está en
 * `RESERVED_SUBDOMAINS`, ese label ES el slug.
 */
export function resolveHostSlug(host: string | null | undefined): string | null {
  const suffix = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX
  const normalized = normalizeHost(host)
  if (!suffix || !normalized) return null
  if (!normalized.endsWith(suffix)) return null

  const label = normalized.slice(0, -suffix.length)
  // Un punto en el label = dos niveles de subdominio, que el certificado wildcard de
  // un solo label NO cubre: falla en TLS antes de llegar a este código.
  if (!label || label.includes(".")) return null
  if (RESERVED_SUBDOMAINS.includes(label)) return null
  return isValidSlugShape(label) ? label : null
}

const stripTrailingSlash = (path: string): string =>
  path.length > 1 && path.endsWith("/") ? path.replace(/\/+$/, "") : path

/**
 * EL núcleo. Puro, sync y testeable sin Next: toda la tabla de precedencia de
 * `resolve-site.test.ts` le pega directo acá.
 */
export function resolveSiteFromParts(parts: SiteResolutionParts): SiteResolution {
  const pathname = stripTrailingSlash(parts.pathname || "/")
  const segments = pathname.split("/")
  const isRootHome = pathname === "/"
  const exitRequested = Boolean(parts.exitRequested)

  const prefixSegment = segments[1]
  const isLegacyPath = prefixSegment === LEGACY_SITE_PATH_SEGMENT
  const isSitePath = prefixSegment === SITE_PATH_SEGMENT || isLegacyPath
  const pathCandidate = isSitePath ? segments[2] : undefined
  const pathSlug = isValidSlugShape(pathCandidate) ? pathCandidate! : null

  // 1. EL HOST GANA, SIN CONDICIONES — y se ignora la cookie por completo.
  //    Una cookie perdida no puede pisar el host: si alguien navegó `moda.…` y
  //    después abre `zapatos.…`, la cookie de `moda` no puede secuestrar la request.
  const hostSlug = resolveHostSlug(parts.host)
  if (hostSlug) {
    return {
      slug: hostSlug,
      source: "host",
      // Bajo host no hay prefijo que poner: el host ya identifica el sitio. Esto es
      // lo que vuelve no-op a todos los call sites de `withSitePrefix`.
      pathPrefix: "",
      rewritePath: isRootHome ? `/${SITE_HOME_ROUTE_SEGMENT}/${hostSlug}` : pathname,
      isLegacyPath: false,
      // `isExit` SIEMPRE false bajo host: la home de una tienda es `/`, y tratarla
      // como salida haría que cada tienda borre su propia sesión y renderice con el
      // branding del principal en su propia home.
      isExit: false,
    }
  }

  // 2. El path.
  if (pathSlug) {
    const subPath = segments.length > 3 ? "/" + segments.slice(3).join("/") : null
    return {
      slug: pathSlug,
      source: "path",
      pathPrefix: `/${SITE_PATH_SEGMENT}/${pathSlug}`,
      // Sin subpath es la HOME del sitio: se reconstruye explícitamente al folder
      // real. Con subpath, se stripea el prefijo y se reusan las rutas existentes.
      rewritePath: subPath ?? `/${SITE_HOME_ROUTE_SEGMENT}/${pathSlug}`,
      isLegacyPath,
      isExit: false,
    }
  }

  // 3. La cookie: mantiene el sitio mientras se navega una sub-ruta sin prefijo.
  //    La HOME RAÍZ y un `?exit_*` siempre terminan la sesión.
  const cookieSlug = parts.cookieSlug || null
  if (cookieSlug && !isRootHome && !exitRequested && isValidSlugShape(cookieSlug)) {
    return {
      slug: cookieSlug,
      source: "cookie",
      // Igual que hoy: en modo cookie los links SÍ llevan prefijo, y así la sesión
      // se sostiene al navegar.
      pathPrefix: `/${SITE_PATH_SEGMENT}/${cookieSlug}`,
      rewritePath: pathname,
      isLegacyPath: false,
      isExit: false,
    }
  }

  // 4. Sitio principal.
  return {
    slug: null,
    source: "none",
    pathPrefix: "",
    rewritePath: pathname,
    isLegacyPath,
    isExit: isRootHome || exitRequested,
  }
}

/**
 * Host canónico de un sitio, o `null` si multi-host no está prendido.
 *
 * Un sitio puede ser alcanzable en hasta TRES hosts: su subdominio,
 * `<principal>/tienda/<slug>`, y una URL de preview. Elegir uno y 308ear los otros es
 * lo que evita que Google indexe contenido duplicado y termine des-indexando las
 * tiendas — por eso las Fases 6 y 7 van juntas: publicar hosts sin canonicals genera
 * duplicados indexados.
 */
export function canonicalHostFor(slug: string): string | null {
  const suffix = process.env.NEXT_PUBLIC_SITE_HOST_SUFFIX
  if (!suffix) return null
  return `${slug}${suffix}`
}

/**
 * Query params que terminan la sesión de sitio.
 *
 * `exit_demo` NO se puede renombrar unilateralmente: lo emite el BACKEND, en
 * `modules/ai-assistant/ai/native-tools/index.ts:423` (`?preview=1&exit_demo=1`).
 * Se aceptan los dos para siempre.
 */
export const EXIT_PARAMS = ["exit_site", "exit_demo"] as const

/** Adaptador: de `NextRequest` a las partes puras. */
export function resolveSite(request: NextRequest): SiteResolution {
  return resolveSiteFromParts({
    host: readRequestHost(request),
    pathname: request.nextUrl.pathname,
    cookieSlug: readSiteSlugCookie(request),
    exitRequested: EXIT_PARAMS.some((p) => request.nextUrl.searchParams.has(p)),
  })
}

/**
 * Cookie del sitio activo, con DOBLE LECTURA.
 *
 * `_site_slug` es la nueva; `_demo_slug` es la vieja y se sigue LEYENDO (nunca
 * escribiendo) por un release. Es la única de las tres superficies renombradas que
 * necesita alias: vive en el browser del usuario, así que el deploy no la migra.
 * (El header no lo necesita: lo emite y lo lee el mismo artefacto de build de Next,
 * y Vercel sirve un deployment inmutable por request.)
 */
export const SITE_SLUG_COOKIE = "_site_slug"
export const LEGACY_SITE_SLUG_COOKIE = "_demo_slug"

export function readSiteSlugCookie(request: NextRequest): string | null {
  return (
    request.cookies.get(SITE_SLUG_COOKIE)?.value ||
    request.cookies.get(LEGACY_SITE_SLUG_COOKIE)?.value ||
    null
  )
}

/**
 * Qué header de host creer — ES UNA DECISIÓN DE SEGURIDAD, no un detalle.
 *
 * Leer `x-forwarded-host` es lo que permite testear la resolución por host en un
 * preview (las preview URLs multi-tenant de Vercel son Enterprise-only, así que la
 * única vía es forjar el header). **Pero también permite SPOOFEAR UN TENANT en
 * producción** si el proveedor no sobreescribe el header que manda el cliente. No se
 * asume que lo haga.
 *
 * Por eso: `x-forwarded-host` SÓLO fuera de producción; en producción, sólo `host`.
 * Consecuencia asumida y explícita: la resolución por host en prod se testea en prod.
 */
export function readRequestHost(request: NextRequest): string | null {
  if (process.env.VERCEL_ENV !== "production") {
    const forwarded = request.headers.get("x-forwarded-host")
    if (forwarded) return forwarded
  }
  return request.headers.get("host")
}
