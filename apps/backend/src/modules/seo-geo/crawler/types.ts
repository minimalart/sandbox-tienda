/** Tipos compartidos del crawler/parser. */

export type FetchClassValue = 'ok' | 'blocked' | 'error';

/** Un enlace extraído de una página. */
export type ExtractedLink = {
  target_url: string;
  anchor: string | null;
  is_internal: boolean;
  is_nofollow: boolean;
};

/**
 * Representación estructurada de una página tras el parseo (PRD §6). Es el
 * insumo de los motores técnico y de arquitectura. Espejo del `PageAnalysis` de
 * open-seo (MIT), en snake_case para alinear con los modelos.
 */
export type PageAnalysis = {
  url: string;
  status_code: number | null;
  fetch_class: FetchClassValue;
  response_time_ms: number | null;
  content_type: string | null;

  canonical_url: string | null;
  canonical_header: string | null;
  robots_meta: string | null;
  x_robots_tag: string | null;
  is_indexable: boolean;

  title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;

  h1_count: number;
  h2_count: number;
  h3_count: number;
  h4_count: number;
  h5_count: number;
  h6_count: number;
  heading_order: number[];

  word_count: number;
  content_hash: string | null;

  images_total: number;
  images_missing_alt: number;
  internal_link_count: number;
  external_link_count: number;
  has_structured_data: boolean;
  structured_data_types: string[];
  hreflang_tags: string[];

  links: ExtractedLink[];

  /**
   * La respuesta es la pantalla de contraseña del site gate, no el sitio.
   *
   * No se persiste (no hay columna en `seo_audit_page`): es una señal de crawl que
   * consume `engines/crawl-health.ts` para invalidar el score. Una tienda gateada
   * devuelve 200 con HTML válido, así que sin este flag se audita el login y el
   * resultado —1 página, 0 hallazgos— se lee como un sitio impecable.
   */
  is_gated: boolean;
};

/** Página tal como se persiste + su profundidad de crawl y clasificación. */
export type CrawledPage = PageAnalysis & {
  crawl_depth: number;
  in_sitemap: boolean;
  page_type: string | null;
};
