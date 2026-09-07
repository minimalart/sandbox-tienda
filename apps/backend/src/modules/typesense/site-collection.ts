/**
 * A qué colección de Typesense le pega cada tienda.
 *
 * **Por qué un mapa y no un sufijo automático:** en Typesense los sinónimos, las
 * curaciones, los presets y los stopwords aplican a la COLECCIÓN entera — no se pueden
 * namespacear por tienda dentro de una. Darle tuning propio a cada tienda exige
 * colecciones separadas, y eso cuesta memoria, un reindexado completo y un job de sync
 * por tienda. Esa decisión es del equipo, no de este archivo.
 *
 * Así que el código queda site-aware y la decisión queda afuera: mientras el mapa esté
 * vacío —que es el default— TODA tienda resuelve a la colección global y el
 * comportamiento es byte por byte el de antes. El día que el equipo cree las
 * colecciones, agrega el mapa y no hay que tocar ninguna ruta.
 *
 *   {"demo_norte":"products_norte","demo_sur":"products_sur"}
 *
 * ─── DE DÓNDE SALE EL MAPA (cambió en la migración a `app-settings`) ─────────
 *
 * Antes salía directo de `process.env[envVar]`. Ahora sale de
 * `typesense/settings.ts`, con la precedencia **DB > env > default**: se edita desde
 * la card de Typesense en el admin y el `.env` queda como fallback vivo, así que una
 * instalación que no toque nada se comporta igual que antes.
 *
 * Aquel acceso dinámico es lo que hizo que estas dos variables fueran invisibles para
 * todos los greps de la auditoría —el texto `process.env.TYPESENSE_SITE_COLLECTIONS`
 * no existía en ninguna línea— y por eso `env-coverage.test.ts` cosecha los literales
 * UPPER_SNAKE de cualquier archivo que tenga un `env[` no literal.
 *
 * Vale dejar escrito el veredicto, porque de él dependía si se podían migrar: NO era
 * un nombre armado en runtime. El parámetro es una unión CERRADA de dos literales,
 * resuelta en compilación, y los ocho call sites pasan uno de esos dos o nada. O sea,
 * un `switch` de dos ramas escrito como índice. Migrarlo no pidió ningún rediseño: el
 * parámetro pasó a nombrar el DESCRIPTOR en vez de la env —mismos dos literales,
 * porque la key del descriptor ES el nombre de la env— y ningún call site cambió.
 */
import { readSiteCollectionsSetting, type SiteCollectionsSetting } from './settings';

export type { SiteCollectionsSetting } from './settings';

/**
 * Normaliza el mapa. Acepta el JSON crudo (como venía del `.env`) o el objeto ya
 * parseado (como viene de `site_setting`, y como lo devuelve `coerceFromEnv` para un
 * descriptor `type: 'json'`).
 *
 * Es DELIBERADAMENTE indulgente: cualquier cosa que no sea un par de strings no
 * vacíos se descarta en silencio, y un JSON malformado se comporta como vacío. Un
 * valor mal pegado NO puede dejar al buscador sin colección.
 *
 * La contracara —ser estricto con lo que un humano acaba de tipear en la card— vive
 * en el `refine` de `descriptors/typesense.ts`, que rechaza a los gritos exactamente
 * lo que esta función descartaría sin decir nada. La asimetría es a propósito.
 */
export function parseSiteCollections(raw?: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (raw === null || raw === undefined) return map;

  let source: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return map;
    try {
      source = JSON.parse(raw);
    } catch {
      // Un JSON mal pegado en una env NO puede dejar el buscador sin colección.
      return map;
    }
  }

  if (typeof source !== 'object' || source === null || Array.isArray(source)) return map;

  for (const [siteId, collection] of Object.entries(source as Record<string, unknown>)) {
    if (typeof collection === 'string' && collection.trim()) {
      map.set(siteId.trim(), collection.trim());
    }
  }
  return map;
}

/**
 * La colección de una tienda, o la global si no tiene la suya.
 *
 * `explicit` gana siempre: es el parámetro `?collection=` que el admin ya aceptaba, y
 * sacárselo rompería el uso actual de quien administra varias colecciones a mano.
 */
export function collectionForSite(
  fallback: string,
  siteId: string | null,
  explicit?: string,
  /**
   * Qué mapa se consulta. La analítica vive en su propia colección
   * (`popular_queries`), así que separarla por tienda pide su propio mapa además del
   * de catálogo — no alcanza con reusar el mismo.
   *
   * Se sigue nombrando con las mismas dos constantes de siempre porque la key del
   * descriptor y el nombre de la env var son el mismo string.
   */
  source: SiteCollectionsSetting = 'TYPESENSE_SITE_COLLECTIONS',
): string {
  if (explicit) return explicit;
  // El corto circuito va ANTES de leer la configuración: sin tienda no hay nada que
  // buscar en el mapa, y así el camino mono-tienda —el 100% de las instalaciones
  // hasta que alguien llene el mapa— no toca el resolver ni una vez.
  if (!siteId) return fallback;
  return parseSiteCollections(readSiteCollectionsSetting(source)).get(siteId) ?? fallback;
}
