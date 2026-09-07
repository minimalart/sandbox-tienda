/**
 * Tipos del seam multitienda. Ver `EXTENSIONES-MULTITIENDA.md` en el root.
 */

/**
 * Una tienda, reducida a lo que el filtrado necesita.
 *
 * `channel_ids` es un ARRAY a propósito, y es lo único que consume el filtrado.
 * Una tienda con `b2b_enabled` tiene DOS sales channels (`sales_channel_id` y
 * `b2b_sales_channel_id`), y ese es un bug vivo hoy: `recurring-order/runtime-config.ts`
 * filtra sólo por el primero, así que el canal mayorista no matchea su propia
 * config y cae al global en silencio. Tipar esto como array es el arreglo
 * estructural: no se puede escribir un filtro por un solo canal sin salirse del tipo.
 */
export type SiteRef = {
  /** `demo_...` — inmutable. El eje declarado. */
  id: string;
  /** Mutable: renombrarlo rompe hosts vivos. Nunca usarlo como clave persistida. */
  slug: string;
  name: string;
  is_main: boolean;
  /** `[sales_channel_id, b2b_sales_channel_id]` sin nulls ni duplicados. */
  channel_ids: string[];
  region_id: string | null;
  stock_location_id: string | null;
};

/** Pistas de las que se puede derivar la tienda, en orden de precedencia. */
export type SiteHint = {
  siteId?: string | null;
  slug?: string | null;
  salesChannelId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  /**
   * Si no hay pista, caer a la tienda `is_main`. El storefront lo quiere; el admin
   * NO —ahí "sin tienda elegida" significa "todas", no "la principal"—, así que en
   * `/admin/*` siempre viaja en `false`.
   */
  allowMainFallback?: boolean;
};

/**
 * Resultado de resolver la tienda de una request.
 *
 * Unión discriminada y no un `SiteRef | null` a propósito: obliga a cada call site
 * a distinguir "no hay tienda elegida" (no filtrar) de "eligieron una que no existe"
 * (romper). Colapsarlos en `null` es exactamente cómo un id stale termina mostrando
 * datos de todas las tiendas mientras el operador cree que ve una sola.
 */
export type SiteResolution =
  /** Hay tienda y hay que filtrar por ella. */
  | { status: 'site'; site: SiteRef }
  /** El registro tiene exactamente una fila. No se filtra: ver nota abajo. */
  | { status: 'singleSite'; site: SiteRef }
  /** Nadie pidió una tienda (o pidieron `*`). No se filtra. */
  | { status: 'allSites' }
  /** Sin módulo, sin tabla o tabla vacía. Proyecto sin multitienda. No se filtra. */
  | { status: 'registryAbsent'; reason: 'module' | 'table' | 'empty' }
  /** Pidieron una tienda que no existe o fue borrada. Rompe, no degrada. */
  | { status: 'unknownSite'; hint: SiteHint };

/**
 * `singleSite` NO es lo mismo que `site`: con una sola tienda, filtrar por sus
 * canales igual escondería filas cuyo canal se creó a mano y no pertenece a
 * ninguna tienda. Con una sola tienda no hay nada que aislar, así que fail-open es
 * lo correcto.
 */
export const shouldFilter = (resolution: SiteResolution): resolution is { status: 'site'; site: SiteRef } =>
  resolution.status === 'site';

/** Code estable para que el admin sepa limpiar su tienda persistida y volver a elegir. */
export const UNKNOWN_SITE_ERROR_CODE = 'MULTISTORE_UNKNOWN_SITE';
