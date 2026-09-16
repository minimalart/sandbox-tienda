import { getSitesHubRequestOrigin, listPublicSites, publicListingUrl } from "@lib/site-config/list-sites";
import { listCategories } from "@lib/data/categories";
import { listCollections } from "@lib/data/collections";
import { listProductsForSeo } from "@lib/data/products";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { getCanonicalOrigin } from "@lib/util/site-url";

// Cached for an hour at the edge; regenerated after that.
// SIN `revalidate`: tenía 3600, o sea UN solo llms.txt cacheado por URL para todos
// los hosts. Leer el Host ya lo vuelve dinámico. El `Cache-Control` de la
// respuesta (más abajo) se conserva: al ser un Response propio, el caché
// compartido se controla a mano y ahí sí discrimina por host la CDN.
export const maxDuration = 60;

const LLMS_PRODUCT_LIMIT: number = 200;

/**
 * Los enlaces fijos, con la marca del sitio ACTIVO interpolada.
 *
 * Era una constante de módulo con "Mercatto" escrito en cuatro descripciones, así que
 * el `llms.txt` de toda tienda generada por el boilerplate le contaba a los modelos que
 * era Mercatto: desdeelsur —una pinturería— publicaba "Información sobre la marca
 * Mercatto" y "Programa de revendedores Mercatto" (DESDEELSUR-49).
 */
const staticLinks = (
  brand: string
): { title: string; path: string; description: string }[] => [
  { title: "Inicio", path: "/", description: `Página principal de ${brand}.` },
  { title: "Tienda", path: "/store", description: "Catálogo completo de productos." },
  {
    title: "Dónde comprar",
    path: "/store-locator",
    description: "Localizador de puntos de venta físicos.",
  },
  {
    title: "Sobre nosotros",
    path: "/about",
    description: `Información sobre la marca ${brand}.`,
  },
  {
    title: "Contacto",
    path: "/contact",
    description: "Formulario y datos de contacto.",
  },
  {
    title: "Trabajá con nosotros",
    path: "/work-with-us",
    description: `Oportunidades laborales en ${brand}.`,
  },
  {
    title: "Revendedores",
    path: "/revendedores",
    description: `Programa de revendedores de ${brand}.`,
  },
  {
    title: "Términos y condiciones",
    path: "/legal/conditions",
    description: "Condiciones generales del servicio.",
  },
  {
    title: "Cambios y devoluciones",
    path: "/legal/exchangesAndReturns",
    description: "Política de cambios y devoluciones.",
  },
  {
    title: "Información legal",
    path: "/legal/legals",
    description: "Avisos legales y políticas.",
  },
];

function line(title: string, url: string, description?: string) {
  return description
    ? `- [${title}](${url}): ${description}`
    : `- [${title}](${url})`;
}

export async function GET() {
  const hub = await getSitesHubRequestOrigin();
  if (hub) return new Response('# Tiendas\n\n' + (await listPublicSites()).map(site => `- [${site.name}](${publicListingUrl(site)})`).join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  const baseUrl = (await getCanonicalOrigin()).replace(/\/$/, "");
  // Esta ruta está excluida del matcher del proxy, pero `getActiveSiteSlug()` tiene el
  // fallback por `Host` puesto justamente para ella (ver `active-tenant.ts`).
  const tenant = await getActiveTenant();
  const brand = tenant.name || tenant.metadata?.name || "Tienda online";
  // `countryCode` ya NO se lee acá.
  //
  // Era `NEXT_PUBLIC_COUNTRY_CODE || NEXT_PUBLIC_DEFAULT_REGION || 'ar'` **sin
  // `.toLowerCase()`**, al contrario de `proxy.ts` y `site-config/site-path.ts`. Con la
  // env en `AR`, `getRegion()` devolvía `undefined` y `listProducts()` un catálogo
  // vacío sin un solo error: este archivo publicaba la sección "## Productos" con cero
  // productos —o sin la sección— mientras el catálogo tenía 2.696 (DESDEELSUR-50).
  //
  // `listProductsForSeo()` no necesita región: acá no se muestran precios.
  const [productsResult, categories, collectionsResult] = await Promise.all([
    listProductsForSeo({ max: LLMS_PRODUCT_LIMIT }).catch(() => ({
      products: [],
      total: 0,
      complete: false,
      truncated: false,
    })),
    listCategories({ limit: 200 }).catch(
      () => [] as Awaited<ReturnType<typeof listCategories>>
    ),
    listCollections({ limit: "200" }).catch(() => ({
      collections: [],
      count: 0,
    })),
  ]);

  const sections: string[] = [];

  /**
   * ─── LA CABECERA SALE DEL TENANT, Y LO QUE NO ESTÁ NO SE INVENTA ────────────
   *
   * Acá había tres literales de Mercatto, uno de ellos un párrafo institucional
   * COMPLETAMENTE FABRICADO para cualquier otra tienda: "transforma cada espacio desde
   * 2010 con fragancias pensadas para crear experiencias sensoriales únicas […] formatos
   * y aromas". desdeelsur —que vende pintura— se lo estuvo sirviendo a los crawlers de
   * modelos como su propia descripción institucional. Es el punto 4 de DESDEELSUR-49.
   *
   * El párrafo no se reemplaza por otro: se BORRA. Un `llms.txt` es lo que un modelo va
   * a repetir sobre el negocio, así que una fecha de fundación o una línea de producto
   * inventadas son peores que la ausencia. Queda la marca (dato real) y el `>` con la
   * descripción SEO que el operador cargó — si no cargó ninguna, no hay `>`.
   *
   * Misma regla que ya rige en el footer (ver `layout/templates/footer/index.tsx`).
   */
  const tagline = (
    tenant.metadata?.seo?.description ||
    tenant.metadata?.description ||
    ""
  ).trim();

  sections.push(`# ${brand}`);
  sections.push("");
  if (tagline) {
    sections.push(`> ${tagline}`);
    sections.push("");
  }

  sections.push("## Páginas principales");
  sections.push("");
  for (const link of staticLinks(brand)) {
    sections.push(line(link.title, `${baseUrl}${link.path}`, link.description));
  }
  sections.push("");

  if (categories.length > 0) {
    sections.push("## Categorías");
    sections.push("");
    for (const category of categories) {
      if (!category.name) continue;
      sections.push(
        line(
          category.name,
          `${baseUrl}/store?category=${encodeURIComponent(category.name)}`,
          category.description ?? undefined
        )
      );
    }
    sections.push("");
  }

  if (collectionsResult.collections.length > 0) {
    sections.push("## Colecciones");
    sections.push("");
    for (const collection of collectionsResult.collections) {
      if (!collection.handle) continue;
      sections.push(
        line(
          collection.title ?? collection.handle,
          `${baseUrl}/collections/${collection.handle}`
        )
      );
    }
    sections.push("");
  }

  // `llms.txt` es un RESUMEN para agentes, no el catálogo: se topea en
  // `LLMS_PRODUCT_LIMIT` y se remite al sitemap para el listado completo. El techo va
  // como `max` para que `listProductsForSeo()` ni pida las páginas de más: acá
  // `truncated` es lo ESPERADO, no una falla.
  const products = productsResult.products;
  if (products.length > 0) {
    sections.push("## Productos");
    sections.push("");
    for (const product of products) {
      sections.push(
        line(
          product.title ?? product.handle,
          `${baseUrl}/products/${product.handle}`,
          product.subtitle ?? undefined
        )
      );
    }
    if (productsResult.total > products.length) {
      sections.push("");
      sections.push(
        `_Mostrando ${products.length} de ${productsResult.total} productos. Consultá /sitemap.xml para el listado completo._`
      );
    }
    sections.push("");
  }

  const body: string = sections.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}