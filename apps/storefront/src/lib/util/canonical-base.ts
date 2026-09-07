/**
 * Base pública del sitio, blindada contra una env mal configurada.
 *
 * `NEXT_PUBLIC_BASE_URL` es una constante de BUILD, así que nadie la ve fallar: no
 * hay warning, no hay 500, no hay test que la mire. Simplemente todo lo que arma
 * URLs absolutas empieza a emitir el valor que tenga.
 *
 * En desdeelsur esa variable quedó con la URL del BACKEND (`http://localhost:9000`) y
 * el sitio estuvo publicando, durante semanas y con 200:
 *
 *   - `<link rel="canonical" href="http://localhost:9000">` en TODA página
 *   - `robots.txt` con `Host:` y `Sitemap:` en localhost
 *   - `sitemap.xml` con todos los `<loc>` en localhost
 *   - `llms.txt` con todas las URLs en localhost
 *   - `og:image` / `twitter:image` en localhost (vía `metadataBase`)
 *
 * Un canonical loopback no es "una preferencia rara de canonicalización": es la
 * instrucción de des-indexar el sitio entero. El motor de auditoría del backend ya lo
 * clasifica como `critical` (`seo-geo/engines/crawl-health.ts`, tipo `local-canonical`)
 * — o sea que el proyecto SABE que este fallo existe, sólo que lo detectaba después
 * de publicado en vez de impedirlo.
 *
 * Este módulo es la contención: un origen loopback NUNCA puede ganarle al host real
 * por el que llegó la request. Es puro y sin `next/headers` a propósito, para poder
 * testear la regla sin montar un request scope.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "::1"]);

/**
 * ¿Este origen apunta a la máquina local?
 *
 * Se mira el HOSTNAME, no el string: `http://localhost:9000`, `http://127.0.0.1:8000`
 * y `https://localhost:8000` son todos loopback, y el puerto no cambia nada. Los
 * subdominios `*.localhost` cuentan (los usa el multi-host en dev).
 *
 * Un valor que no parsea devuelve `false`: no se puede afirmar que sea local, y
 * "reparar" algo que no entendemos es peor que dejarlo. Igual reventaría más arriba,
 * en el `new URL()` de `metadataBase`.
 */
export function isLoopbackOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const host = hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * La base que hay que publicar: la configurada, salvo que sea loopback y la request
 * haya llegado por un host real.
 *
 * Las tres combinaciones, y por qué cada una es la correcta:
 *
 *  1. Base pública (el caso sano) → se devuelve TAL CUAL, sin mirar la request. Es lo
 *     que mantiene el canonical estable aunque el sitio sea alcanzable por varios
 *     hosts, que es justamente para lo que existe un canonical.
 *  2. Base loopback + request loopback (dev) → se devuelve la CONFIGURADA. En dev el
 *     storefront corre en `:8000` y no queremos que un request a otro puerto le
 *     cambie las URLs; y quien desarrolla espera ver su valor.
 *  3. Base loopback + request pública (producción mal configurada) → gana la REQUEST.
 *     El host por el que el usuario —o el crawler— llegó es, por definición, un host
 *     público real del sitio. Emitir eso es siempre mejor que emitir `localhost`.
 *
 * Esto NO reemplaza configurar bien la variable: el valor sano es explícito y no
 * depende del host de cada request. Es un piso, no un default.
 */
export function preferPublicOrigin(configured: string, requestOrigin: string): string {
  if (!isLoopbackOrigin(configured)) return configured;
  if (!requestOrigin || isLoopbackOrigin(requestOrigin)) return configured;
  return requestOrigin;
}
