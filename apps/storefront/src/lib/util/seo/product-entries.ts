import { isHiddenFromStore } from "@lib/util/hidden-product";

/**
 * Forma MÍNIMA de producto que consumen las superficies SEO (`sitemap.xml`, `llms.txt`).
 *
 * No hay precio ni stock a propósito: un `<loc>` no los muestra, y pedirlos es lo que
 * ató el sitemap al cálculo de precios y a la resolución de región. Ver
 * `listProductsForSeo()` en `lib/data/products.ts` para por qué eso importa.
 */
export type SeoProduct = {
  handle: string;
  title: string | null;
  subtitle: string | null;
  updatedAt: string | null;
};

/** Lo que hace falta leer de un producto del store API. Deliberadamente laxo. */
type RawProduct = {
  handle?: string | null;
  title?: string | null;
  subtitle?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Normaliza un producto del store API, o `null` si no debe publicarse.
 *
 * Se descarta en dos casos, y los dos son "URL muerta", no "producto raro":
 *
 *  - **Sin `handle`**: la URL del PDP se arma con el handle. Sin él no hay URL.
 *  - **`hidden_from_store`**: el PDP por handle ya devuelve 404 para estos (son los
 *    regalos que agregan las promos), así que declararlos sería publicar un 404 en el
 *    sitemap. Mismo criterio que `listProducts()`.
 */
export function toSeoProduct(raw: RawProduct | null | undefined): SeoProduct | null {
  if (!raw?.handle) return null;
  if (isHiddenFromStore(raw)) return null;
  return {
    handle: raw.handle,
    title: raw.title ?? null,
    subtitle: raw.subtitle ?? null,
    updatedAt: raw.updated_at ?? null,
  };
}

/**
 * Los offsets a pedir para cubrir `count` productos en páginas de `limit`, sin pasarse
 * de `cap` productos.
 *
 * Incluye el `0`: el llamador ya trajo esa página (es de donde salió `count`), así que
 * consume `.slice(1)`. Devolverlos todos es lo que hace la función testeable sin
 * inventarle un contrato raro — "cuáles son las páginas de este catálogo" tiene una
 * sola respuesta correcta.
 *
 * `cap` es cuántos productos como MÁXIMO quiere publicar el llamador. Cubre dos usos
 * distintos y por eso no se llama `hardCap`: el sitemap le pasa un techo de seguridad
 * (que un `count` mal devuelto no dispare cientos de requests) y `llms.txt` le pasa un
 * truncado deliberado, porque es un resumen para agentes y no el catálogo. Quién de los
 * dos es lo decide el llamador; acá el cálculo es el mismo.
 */
export function seoPageOffsets(count: number, limit: number, cap: number): number[] {
  if (!Number.isFinite(count) || count <= 0) return [0];
  if (!Number.isFinite(limit) || limit <= 0) return [0];

  const reachable = Math.min(count, cap);
  const offsets: number[] = [];
  for (let offset = 0; offset < reachable; offset += limit) {
    offsets.push(offset);
  }
  return offsets.length > 0 ? offsets : [0];
}
