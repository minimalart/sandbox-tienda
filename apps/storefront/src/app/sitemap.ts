import { listBlogCategories, listBlogPosts } from "@lib/data/blog";
import { listCollections } from "@lib/data/collections";
import { listProducts } from "@lib/data/products";
import { getCanonicalOrigin, getCanonicalPath } from "@lib/util/site-url";
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

// El presupuesto de fetch (abajo) puede llegar a ~42s, que supera el timeout por
// default de una función serverless ahora que esto dejó de ser build-time.
export const maxDuration = 60;

// Contra un backend remoto/frío los fetches pueden colgarse. Estos límites convierten
// un fetch colgado en una respuesta parcial acotada en vez de un timeout: ya hubo un
// deploy roto por el sitemap colgado. Se conservan TAL CUAL.
// Worst caso: presupuesto (30s) + un último request en vuelo (12s) ≈ 42s.
const PER_REQUEST_TIMEOUT_MS: number = 12_000;
const FETCH_BUDGET_MS: number = 30_000;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`[sitemap] ${label} timed out after ${ms}ms`)),
          ms
        );
        // No mantener vivo el proceso del build por este timer.
        (timer as { unref?: () => void }).unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

const PRODUCT_PAGE_LIMIT: number = 100;
const MAX_PRODUCT_PAGES: number = 50; // hard cap: up to 5,000 products

async function fetchAllProducts(countryCode: string) {
  const products: { handle: string; updatedAt?: string | null }[] = [];
  let page: number = 1;
  const startedAt: number = Date.now();

  for (let i: number = 0; i < MAX_PRODUCT_PAGES; i++) {
    // Presupuesto acumulado: si paginar todo el catálogo se acerca al timeout
    // del build, cortamos con lo que tengamos (el ISR completa el resto luego).
    if (Date.now() - startedAt > FETCH_BUDGET_MS) {
      console.warn(
        `[sitemap] product fetch budget (${FETCH_BUDGET_MS}ms) exceeded at page ${page}; returning ${products.length} products`
      );
      break;
    }

    let response: Awaited<ReturnType<typeof listProducts>>["response"];
    let nextPage: Awaited<ReturnType<typeof listProducts>>["nextPage"];
    try {
      const result = await withTimeout(
        listProducts({
          pageParam: page,
          queryParams: { limit: PRODUCT_PAGE_LIMIT },
          countryCode,
        }),
        PER_REQUEST_TIMEOUT_MS,
        `products page ${page}`
      );
      response = result.response;
      nextPage = result.nextPage;
    } catch (error) {
      console.warn(
        `[sitemap] product fetch failed/timed out at page ${page}; returning ${products.length} products:`,
        error
      );
      break;
    }

    for (const p of response.products) {
      if (p.handle) {
        products.push({ handle: p.handle, updatedAt: p.updated_at });
      }
    }

    if (!nextPage) break;
    page = nextPage;
  }

  return products;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Origen canónico + prefijo de tienda: las URLs del sitemap tienen que ser LAS MISMAS
  // que el `<link rel="canonical">` de cada página, o el sitemap declara URLs que se
  // canonicalizan a otra parte. Hoy `getCanonicalPath()` devuelve '' acá (esta ruta está
  // excluida del matcher del proxy, así que no recibe `x-site-slug`), pero deja de
  // hacerlo en cuanto el sitio se resuelva por host.
  const origin: string = (await getCanonicalOrigin()).replace(/\/$/, "");
  const baseUrl: string = `${origin}${await getCanonicalPath()}`;
  const countryCode: string =
    process.env.NEXT_PUBLIC_COUNTRY_CODE ||
    process.env.NEXT_PUBLIC_DEFAULT_REGION ||
    "ar";
  const now = new Date();

  const [products, collectionsResult, blogPostsResult, blogCategories] =
    await Promise.all([
      fetchAllProducts(countryCode).catch((error) => {
        console.error("[sitemap] Failed to fetch products:", error);
        return [] as { handle: string; updatedAt?: string | null }[];
      }),
      withTimeout(listCollections({ limit: "200" }), PER_REQUEST_TIMEOUT_MS, "collections").catch((error) => {
        console.error("[sitemap] Failed to fetch collections:", error);
        return { collections: [], count: 0 };
      }),
      withTimeout(listBlogPosts({ limit: 1000 }), PER_REQUEST_TIMEOUT_MS, "blog posts").catch((error) => {
        console.error("[sitemap] Failed to fetch blog posts:", error);
        return { posts: [], count: 0 };
      }),
      withTimeout(listBlogCategories(), PER_REQUEST_TIMEOUT_MS, "blog categories").catch((error) => {
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

  for (const product of products) {
    entries.push({
      url: `${baseUrl}/products/${product.handle}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
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