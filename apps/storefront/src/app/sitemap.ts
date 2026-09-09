import { listBlogCategories, listBlogPosts } from "@lib/data/blog";
import { listCollections } from "@lib/data/collections";
import { listProductsForSeo } from "@lib/data/products";
import { getCanonicalOrigin, getCanonicalPath } from "@lib/util/site-url";
import { withTimeout } from "@lib/util/with-timeout";
import type { MetadataRoute } from "next";

/**
 * SIN `revalidate`, a propósito.
 *
 * Antes tenía `revalidate = 3600`, o sea que se prerenderizaba y se servía UN ÚNICO
 * sitemap desde el Full Route Cache — keyeado sólo por URL — para TODOS los hosts.
 * Con varias tiendas eso publica el sitemap del sitio A en el dominio de B.
 *
 * Leer el `Host` (vía `getCanonicalOrigin`) ya la vuelve dinámica sola. Se pierde el
 * caché de CDN del sitemap; se gana que cada host publique el suyo.
 *
 * POR QUÉ SIGUE SIENDO `sitemap.ts` Y NO SE MOVIÓ A `sitemap.xml/route.ts`
 * (que permitiría setear `Cache-Control` a mano y recuperar el caché de CDN):
 *
 *  1. `app/sitemap.ts` es **`managed_file` de la extensión `blog`** Y está listado
 *     como raíz en `packages/project-composer/src/component-definitions.js:9`.
 *     Moverlo rompe `site:components:verify` y además deja a los proyectos generados
 *     sin sitemap **en silencio** (`fs.rmSync` con `force: true` no falla si el path
 *     no existe).
 *  2. Con la convención `sitemap.ts`, **Next serializa y escapea el XML**. Escrito a
 *     mano habría que escapar `& < > " '` en cada `<loc>`, y las URLs de categorías se
 *     arman con nombres que vienen de datos de usuario: un `&` crudo invalida el
 *     sitemap ENTERO.
 *
 * Recuperar el caché de CDN es su propio PR, cuando alguien mida si la carga de
 * crawlers lo justifica.
 */

// El peor caso sigue pudiendo llegar a ~42s (el presupuesto de `listProductsForSeo`,
// 30s, más un último request en vuelo de 12s), que supera el timeout por default de una
// función serverless ahora que esto dejó de ser build-time. El caso MEDIDO es mucho más
// bajo: 2.696 productos en 6 páginas de 500 ≈ 5,5s.
export const maxDuration = 60;

// Contra un backend remoto/frío los fetches pueden colgarse. Este límite convierte
// un fetch colgado en una respuesta parcial acotada en vez de un timeout: ya hubo un
// deploy roto por el sitemap colgado.
//
// El presupuesto acumulado de PRODUCTOS ya no vive acá: se lo lleva
// `listProductsForSeo()`, que es quien pagina. Este timeout cubre los fetches de una
// sola página (colecciones, posts, categorías del blog).
const PER_REQUEST_TIMEOUT_MS: number = 12_000;

type StaticRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

// Static routes exposed to end users. URLs are written WITHOUT the
// [countryCode] prefix — middleware.ts handles the internal rewrite.
const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/store", changeFrequency: "daily", priority: 0.9 },
  { path: "/blog", changeFrequency: "daily", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/legal/conditions", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/exchangesAndReturns", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/legals", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Origen canónico + prefijo de tienda: las URLs del sitemap tienen que ser LAS MISMAS
  // que el `<link rel="canonical">` de cada página, o el sitemap declara URLs que se
  // canonicalizan a otra parte. Hoy `getCanonicalPath()` devuelve '' acá (esta ruta está
  // excluida del matcher del proxy, así que no recibe `x-site-slug`), pero deja de
  // hacerlo en cuanto el sitio se resuelva por host.
  const origin: string = (await getCanonicalOrigin()).replace(/\/$/, "");
  const baseUrl: string = `${origin}${await getCanonicalPath()}`;
  const now = new Date();

  // `countryCode` ya NO se lee acá.
  //
  // Era `NEXT_PUBLIC_COUNTRY_CODE || NEXT_PUBLIC_DEFAULT_REGION || 'ar'` **sin
  // `.toLowerCase()`**, al revés de `proxy.ts` y `site-config/site-path.ts`, que sí lo
  // bajan. Con la env en `AR` el proxy rewriteaba a `/ar/...` (PDP perfecto) mientras
  // este archivo le pasaba `AR` a `listProducts()` → `getRegion()` devolvía `undefined`
  // → catálogo vacío SIN error. Así publicó desdeelsur 12 URLs y ninguno de sus 2.696
  // productos (DESDEELSUR-50).
  //
  // `listProductsForSeo()` no pide región: el sitemap no muestra precios. El país deja
  // de ser una dependencia en vez de quedar "arreglado" con un lowercase que el próximo
  // archivo se vuelve a olvidar.
  const [productsResult, collectionsResult, blogPostsResult, blogCategories] =
    await Promise.all([
      listProductsForSeo().catch((error) => {
        console.error("[sitemap] Failed to fetch products:", error);
        return { products: [], total: 0, complete: false, truncated: false };
      }),
      withTimeout(listCollections({ limit: "200" }), PER_REQUEST_TIMEOUT_MS, "sitemap: collections").catch((error) => {
        console.error("[sitemap] Failed to fetch collections:", error);
        return { collections: [], count: 0 };
      }),
      withTimeout(listBlogPosts({ limit: 1000 }), PER_REQUEST_TIMEOUT_MS, "sitemap: blog posts").catch((error) => {
        console.error("[sitemap] Failed to fetch blog posts:", error);
        return { posts: [], count: 0 };
      }),
      withTimeout(listBlogCategories(), PER_REQUEST_TIMEOUT_MS, "sitemap: blog categories").catch((error) => {
        console.error("[sitemap] Failed to fetch blog categories:", error);
        return [] as Awaited<ReturnType<typeof listBlogCategories>>;
      }),
    ]);

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  for (const product of productsResult.products) {
    entries.push({
      url: `${baseUrl}/products/${product.handle}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // Un sitemap incompleto se sirve igual —mejor 2.000 URLs que ninguna— pero NO en
  // silencio. Que esto no existiera es la razón por la que un sitemap con CERO
  // productos respondió 200 durante semanas sin que nada lo levantara.
  if (!productsResult.complete) {
    console.error(
      `[sitemap] productos INCOMPLETOS: ${productsResult.products.length} publicados de ` +
        `${productsResult.total}. Ver los logs de [seo-products] para la causa.`
    );
  }

  // El techo de seguridad no es una configuración: si un catálogo lo toca, el problema
  // no es subirlo sino que un sitemap tiene un máximo de 50.000 URLs y 50 MB. A partir
  // de ahí hace falta un índice de sitemaps, que es su propio PR.
  if (productsResult.truncated) {
    console.error(
      `[sitemap] el catálogo (${productsResult.total}) supera el techo de productos: ` +
        `se publican ${productsResult.products.length}. Hace falta un sitemap indexado.`
    );
  }

  // Las CATEGORÍAS no se publican.
  //
  // Antes iba una entrada `/store?category=<nombre>` por categoría, porque
  // `/categories/<handle>` redirige ahí. Eso ponía en el sitemap 25 URLs de FACETA que
  // comparten HTML con `/store` (el listado se renderiza client-side contra Typesense):
  // sin H1, ~118 palabras, sin structured data y —hasta este PR— canonicalizadas a la
  // home. La auditoría del 19/08 las levantó como thin-content y contenido duplicado.
  //
  // Ahora `/store` canonicaliza cualquier faceta a sí mismo y el sitemap no las declara.
  // Publicar categorías vuelve a tener sentido cuando exista una página de categoría
  // real (server-side, con H1 e ItemList); ese es su propio PR.

  for (const collection of collectionsResult.collections) {
    if (!collection.handle) continue;
    entries.push({
      url: `${baseUrl}/collections/${collection.handle}`,
      lastModified: collection.updated_at
        ? new Date(collection.updated_at)
        : now,
      changeFrequency: "weekly",
      priority: 0.7,
    });
  }

  for (const post of blogPostsResult.posts) {
    if (!post.slug) continue;
    entries.push({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.published_at
        ? new Date(post.published_at)
        : post.updated_at
          ? new Date(post.updated_at)
          : now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const category of blogCategories) {
    if (!category.slug) continue;
    entries.push({
      url: `${baseUrl}/blog/categoria/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    });
  }

  return entries;
}