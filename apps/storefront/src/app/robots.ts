import { SITE_PATH_SEGMENT } from "@lib/site-config/resolve-site";
import { isSiteGateEnabled } from "@lib/site-config/site-gate";
import { getCanonicalOrigin, isCanonicalForm } from "@lib/util/site-url";
import type { MetadataRoute } from "next";

/**
 * Rutas que ningún crawler debería pedir: privadas del cliente, transaccionales o API.
 *
 * Se emiten DOS veces: la ruta pelada y `/tienda/*<ruta>`. Las tiendas alcanzadas por
 * `/tienda/<slug>` viven en el MISMO host, así que comparten este `robots.txt`, y con
 * sólo la forma pelada `/tienda/desde-el-sur/account` no matcheaba ninguna regla: la
 * auditoría del 19/08 crawleó y midió esa página respetando robots.
 *
 * Las facetas de `/store` (`?brand=`, `?category=`, `?promos=`) NO se bloquean acá a
 * propósito: un `Disallow: /store?*` impide que Google LEA su `<link rel="canonical">`,
 * y sin leerlo no consolida las que ya tiene indexadas — quedarían como "indexada pero
 * bloqueada". Se consolidan por canonical (`store/page.tsx`) y saliendo del sitemap.
 */
const PRIVATE_PATHS = [
  "/account",
  "/cart",
  "/checkout",
  "/order",
  "/lista-de-compras",
  "/comparar",
  "/reset-password",
  "/not-found",
  "/api/",
] as const;

/**
 * `robots.txt` por HOST.
 *
 * Esta ruta está EXCLUIDA del matcher del proxy, así que nunca recibe
 * `x-site-slug`: resuelve el sitio leyendo el `Host` ella misma, vía el fallback que
 * `getActiveSiteSlug()` tiene para exactamente este caso.
 *
 * Antes no declaraba `revalidate` y por lo tanto era ESTÁTICA: un único `robots.txt`
 * servido en todos los hosts, con el `sitemap:` y el `host:` del sitio principal. Al
 * leer los headers pasa a ser dinámica sola, que es lo que corresponde.
 *
 * Con multi-host apagado devuelve exactamente lo de antes: `isCanonicalHost()` es
 * `true` y el origen es `getBaseURL()`.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [canonical, isCanonical, gated] = await Promise.all([
    getCanonicalOrigin(),
    isCanonicalForm(),
    isSiteGateEnabled(),
  ]);
  const baseUrl: string = canonical.replace(/\/$/, "");

  /**
   * Sitio detrás del password gate: NO se indexa, y tampoco se declara el sitemap.
   *
   * Con el gate prendido toda URL responde 200 con la pantalla "Sitio en preparación"
   * (~120 caracteres visibles) y el `<title>` correcto, porque `generateMetadata`
   * corre igual. Declarar `Allow: /` más un sitemap ahí es invitar a Google a indexar
   * N copias casi idénticas de un muro de contraseña: entra como thin content y
   * contenido duplicado, y el sitio arranca su vida indexada desde ese pozo.
   *
   * Es la MISMA política que el bloque de abajo aplica a un host no canónico: si el
   * contenido real no está servible, no se pide crawl. El gate es temporal; lo que
   * queda en el índice, no. Al apagarlo desde el admin esto se da vuelta solo.
   */
  if (gated) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      host: baseUrl,
    };
  }

  // Host NO canónico (una tienda alcanzada por `/tienda/<slug>` en el host principal,
  // un preview, un host desconocido): se bloquea la indexación ENTERA. Si no, Google
  // indexa el mismo contenido en dos o tres hosts, lo marca como duplicado y termina
  // des-indexando la tienda.
  if (!isCanonical) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS.flatMap((path) => [path, `/${SITE_PATH_SEGMENT}/*${path}`]),
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    // `host` es una directiva de Yandex que fija UN host canónico. Antes salía el del
    // env para todos los hosts; ahora es el canónico del sitio activo.
    host: baseUrl,
  };
}
