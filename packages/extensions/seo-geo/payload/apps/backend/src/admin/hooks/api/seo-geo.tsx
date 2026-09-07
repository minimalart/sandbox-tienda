import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../lib/client';
import { queryKeysFactory } from '../../lib/query-key-factory';
import { toQueryString } from '../../lib/query-string';

// ---------------------------------------------------------------------------
// Tipos (espejo liviano de las entidades del backend, sólo lo que usa la UI).
// ---------------------------------------------------------------------------
export type AuditStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type FindingSeverity = 'critical' | 'warning' | 'info';
export type FindingEngine = 'technical' | 'architecture' | 'catalog' | 'geo' | 'commercial' | 'performance' | 'crawl';

export interface FindingsSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  by_engine: Record<string, number>;
  by_type: Record<string, number>;
}

export interface SeoAudit {
  id: string;
  sales_channel_id: string | null;
  base_url: string | null;
  status: AuditStatus;
  current_phase: string | null;
  trigger: string;
  pages_crawled: number;
  pages_total: number;
  seo_score: number | null;
  ai_visibility_score: number | null;
  ai_visibility_breakdown: Record<string, number> | null;
  findings_summary: FindingsSummary | null;
  error_summary: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeoFinding {
  id: string;
  audit_id: string;
  engine: FindingEngine;
  type: string;
  severity: FindingSeverity;
  entity_type: string;
  entity_id: string | null;
  page_url: string | null;
  details: Record<string, unknown> | null;
  status: 'open' | 'fixed' | 'dismissed';
  impact: number | null;
  created_at: string;
}

interface AuditsListResponse {
  audits: SeoAudit[];
  count: number;
  offset: number;
  limit: number;
}
interface AuditDetailResponse {
  audit: SeoAudit;
  findings: SeoFinding[];
  findings_count: number;
  pages_count: number;
}
interface DashboardResponse {
  latest: SeoAudit | null;
  recent: SeoAudit[];
  seo_score: number | null;
  ai_visibility_score: number | null;
  ai_visibility_breakdown: Record<string, number> | null;
  findings_summary: FindingsSummary | null;
}
interface FindingsListResponse {
  findings: SeoFinding[];
  count: number;
  offset: number;
  limit: number;
  audit_id: string | null;
}

/** Copys legibles por tipo de hallazgo (PRD §9/§14). Fallback = el slug. */
export const FINDING_LABELS: Record<string, string> = {
  'missing-title': 'Sin título',
  'title-too-long': 'Título demasiado largo',
  'title-too-short': 'Título demasiado corto',
  'missing-meta-description': 'Sin meta description',
  'meta-description-too-long': 'Meta description larga',
  'meta-description-too-short': 'Meta description corta',
  'missing-h1': 'Sin H1',
  'multiple-h1': 'Múltiples H1',
  'heading-order-skip': 'Salto en jerarquía de encabezados',
  'noindex-page': 'Página noindex',
  'canonical-conflict': 'Conflicto de canonical',
  'canonicalized-page': 'Página canonicalizada',
  'thin-content': 'Contenido escaso',
  'images-missing-alt': 'Imágenes sin alt',
  'missing-structured-data': 'Sin datos estructurados (JSON-LD)',
  'no-outgoing-links': 'Sin enlaces salientes',
  'deep-page': 'Página muy profunda',
  'blocked-page': 'Página bloqueada (WAF/bot)',
  'server-error': 'Error de servidor (5xx)',
  'broken-page': 'Página rota (4xx)',
  'fetch-error': 'Error de red',
  'slow-response': 'Respuesta lenta',
  'duplicate-title': 'Título duplicado',
  'duplicate-meta-description': 'Meta description duplicada',
  'duplicate-content': 'Contenido duplicado',
  'broken-internal-link': 'Enlace interno roto',
  'orphan-page': 'Página huérfana',
  // Salud del crawl (`engines/crawl-health.ts`): no describen el sitio, describen
  // que la auditoría no pudo mirarlo. Por eso el copy dice qué hacer.
  'empty-crawl': 'El crawl no leyó ninguna página',
  'site-gated': 'Tienda detrás de la contraseña (site gate)',
  'crawl-dead-end': 'El crawl no encontró por dónde seguir',
  'local-canonical': 'Canonical apuntando a localhost',
  // Catálogo y GEO. Son hallazgos AGREGADOS —un tipo, N productos afectados— y por
  // eso el copy está en plural: no describen una página, describen el catálogo.
  'catalog-missing-description': 'Productos sin descripción',
  'catalog-short-description': 'Descripción demasiado corta',
  'catalog-missing-subtitle': 'Productos sin subtítulo',
  'catalog-missing-sku': 'Productos sin SKU',
  'catalog-missing-gtin': 'Productos sin GTIN/EAN/UPC',
  'catalog-missing-brand': 'Productos sin marca',
  'catalog-no-categories': 'Productos sin categoría',
  'catalog-no-images': 'Productos sin imágenes',
  'catalog-images-missing-alt': 'Imágenes de producto sin alt',
  'catalog-duplicate-description': 'Descripción duplicada entre productos',
  'geo-no-use-cases': 'Sin casos de uso',
  'geo-no-materials': 'Sin materiales',
  'geo-not-comparable': 'Sin atributos comparables',
  'geo-no-compatibilities': 'Sin compatibilidades',
  'geo-no-benefits': 'Sin beneficios',
  'geo-no-faq': 'Sin preguntas frecuentes',
};

export const findingLabel = (t: string): string => FINDING_LABELS[t] ?? t;

/**
 * Estado y fase de una auditoría, en castellano. El resto del admin está en
 * castellano y estos dos slugs son los únicos que se mostraban crudos: el badge
 * decía `queued` sobre una tarjeta titulada Auditorías recientes.
 *
 * Viven acá y no en cada pantalla porque los pintan tres (dashboard, listado y
 * detalle) y un estado traducido en una sola se lee como dos estados distintos.
 */
export const AUDIT_STATUS_LABELS: Record<string, string> = {
  queued: 'En cola',
  running: 'En curso',
  paused: 'Pausada',
  completed: 'Completada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

export const auditStatusLabel = (s: string): string => AUDIT_STATUS_LABELS[s] ?? s;

/** Fases del pipeline (`AUDIT_PHASES` del modelo), para el badge de progreso. */
export const AUDIT_PHASE_LABELS: Record<string, string> = {
  discovery: 'descubrimiento',
  crawl: 'rastreo',
  analyze: 'análisis',
  score: 'puntaje',
  finalize: 'cierre',
};

export const auditPhaseLabel = (p: string): string => AUDIT_PHASE_LABELS[p] ?? p;

/**
 * Motor y severidad de un hallazgo, en castellano. Los nombres de motor son los
 * mismos que la pantalla de Configuración ya mostraba traducidos en los toggles:
 * la tabla de Hallazgos los imprimía crudos y quedaban dos vocabularios para la
 * misma cosa.
 */
export const ENGINE_LABELS: Record<string, string> = {
  technical: 'Técnico',
  architecture: 'Arquitectura',
  catalog: 'Catálogo',
  geo: 'GEO',
  commercial: 'Comercial',
  performance: 'Performance',
  crawl: 'Crawl',
};

export const engineLabel = (e: string): string => ENGINE_LABELS[e] ?? e;

export const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Crítico',
  warning: 'Advertencia',
  info: 'Info',
};

export const severityLabel = (s: string): string => SEVERITY_LABELS[s] ?? s;

/**
 * Objetivo legible de un hallazgo.
 *
 * Los de catálogo y GEO son agregados de sitio: no tienen `page_url` ni `entity_id`,
 * así que las tablas los mostraban con un guión —el hallazgo más accionable de todos,
 * 2.660 productos sin descripción, se veía como el menos—. El conteo vive en
 * `details.count` desde que los emiten `engines/catalog.ts` y `geo/aggregate.ts`;
 * lo único que faltaba era leerlo.
 */
export const findingTarget = (f: SeoFinding): string => {
  if (f.page_url) return f.page_url;
  const count = (f.details as { count?: number } | null)?.count;
  if (typeof count === 'number') return `${count} producto${count === 1 ? '' : 's'}`;
  return f.entity_id || '—';
};

/** Productos afectados por un hallazgo agregado, o `null` si no es de los que cuentan. */
export const findingCount = (f: SeoFinding): number | null => {
  const count = (f.details as { count?: number } | null)?.count;
  return typeof count === 'number' ? count : null;
};

/**
 * Qué gap de Correcciones IA cierra cada hallazgo GEO.
 *
 * Es el puente que faltaba entre "AI Visibility dice que falta X" y la pantalla que
 * genera X. Los de catálogo no están: sin descripción, sin imágenes o sin SKU no se
 * resuelven redactando —se resuelven cargando el dato— y ofrecer la IA ahí sería
 * prometer que inventa un SKU.
 */
export const CORRECTION_GAP_BY_FINDING: Record<string, string> = {
  'geo-no-use-cases': 'use_cases',
  'geo-no-benefits': 'benefits',
  'geo-no-materials': 'materials',
  'geo-not-comparable': 'comparison',
  'geo-no-faq': 'faq',
};

export const severityColor = (s: FindingSeverity): string =>
  s === 'critical' ? 'red' : s === 'warning' ? 'orange' : 'grey';

export const seoGeoQueryKey = queryKeysFactory('seo-geo');

export const useSeoDashboard = () =>
  useQuery({
    queryKey: seoGeoQueryKey.detail('dashboard'),
    queryFn: () => sdk.client.fetch<DashboardResponse>('/admin/seo-geo/dashboard', { method: 'GET' }),
  });

export const useAudits = (query?: Record<string, unknown>) => {
  const qs = toQueryString(query);
  return useQuery({
    queryKey: seoGeoQueryKey.list(query),
    queryFn: () =>
      sdk.client.fetch<AuditsListResponse>(`/admin/seo-geo/audits${qs ? `?${qs}` : ''}`, { method: 'GET' }),
  });
};

export const useAudit = (id: string, enabled = true) =>
  useQuery({
    queryKey: seoGeoQueryKey.detail(id),
    enabled: Boolean(id) && enabled,
    // Refresca mientras la auditoría está en curso (progreso por fase).
    refetchInterval: (q) => {
      const s = (q.state.data as AuditDetailResponse | undefined)?.audit?.status;
      return s === 'queued' || s === 'running' ? 3000 : false;
    },
    queryFn: () => sdk.client.fetch<AuditDetailResponse>(`/admin/seo-geo/audits/${id}`, { method: 'GET' }),
  });

export const useFindings = (query?: Record<string, unknown>) => {
  const qs = toQueryString(query);
  return useQuery({
    queryKey: [...seoGeoQueryKey.list(query), 'findings'],
    queryFn: () =>
      sdk.client.fetch<FindingsListResponse>(`/admin/seo-geo/findings${qs ? `?${qs}` : ''}`, { method: 'GET' }),
  });
};

export interface AiVisibilityBreakdown {
  comprehension: number;
  coverage: number;
  authority: number;
  comparability: number;
  structured_data: number;
  depth: number;
}
export interface AiVisibilitySnapshot {
  id: string;
  audit_id: string;
  sales_channel_id: string | null;
  score: number;
  breakdown: AiVisibilityBreakdown | null;
  products_total: number;
  products_sufficient: number;
  coverage_percent: number;
  captured_at: string;
}
interface AiVisibilityResponse {
  latest: AiVisibilitySnapshot | null;
  history: AiVisibilitySnapshot[];
}

export const useAiVisibility = (query?: Record<string, unknown>) => {
  const qs = toQueryString(query);
  return useQuery({
    queryKey: [...seoGeoQueryKey.detail('ai-visibility'), query],
    queryFn: () =>
      sdk.client.fetch<AiVisibilityResponse>(`/admin/seo-geo/ai-visibility${qs ? `?${qs}` : ''}`, { method: 'GET' }),
  });
};

/** Etiquetas legibles de las dimensiones del AI Visibility Score (PRD §11). */
export const AI_DIMENSION_LABELS: Record<keyof AiVisibilityBreakdown, string> = {
  comprehension: 'Comprensión',
  coverage: 'Cobertura',
  authority: 'Autoridad',
  comparability: 'Comparabilidad',
  structured_data: 'Datos estructurados',
  depth: 'Profundidad',
};

export const useCreateAudit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      sdk.client.fetch<{ audit: SeoAudit }>('/admin/seo-geo/audits', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: seoGeoQueryKey.lists() }),
  });
};

/** Acción de ciclo de vida sobre una auditoría (cancel/pause/resume). */
export const useAuditAction = (action: 'cancel' | 'pause' | 'resume') => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch<{ audit: SeoAudit }>(`/admin/seo-geo/audits/${id}/${action}`, { method: 'POST', body: {} }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: seoGeoQueryKey.detail(id) });
      qc.invalidateQueries({ queryKey: seoGeoQueryKey.lists() });
      qc.invalidateQueries({ queryKey: seoGeoQueryKey.detail('dashboard') });
    },
  });
};

export interface SimulatorResult {
  answer: string;
  used: Array<{ product_id: string; title: string | null; similarity: number }>;
  not_used: Array<{ product_id: string; title: string | null; similarity: number; reason: string }>;
  configured: boolean;
  indexed: number;
}

export const useSimulator = () =>
  useMutation({
    mutationFn: ({ prompt, embed }: { prompt: string; embed?: boolean }) =>
      sdk.client.fetch<SimulatorResult>(`/admin/seo-geo/simulator${embed ? '?embed=1' : ''}`, {
        method: 'POST',
        body: { prompt },
      }),
  });

export interface CorrectionProposals {
  product_id: string;
  proposals: Record<string, unknown>;
  configured: boolean;
  used_catalogador: boolean;
}

export interface ProductSearchHit {
  id: string;
  title: string;
  thumbnail: string | null;
}

/** Busca productos por nombre (endpoint admin estándar de Medusa) para el buscador
 * de Correcciones. Habilitado sólo con 2+ caracteres. */
export const useProductSearch = (term: string) =>
  useQuery({
    queryKey: [...seoGeoQueryKey.list({ product_search: term })],
    enabled: term.trim().length >= 2,
    queryFn: () =>
      sdk.client.fetch<{ products: ProductSearchHit[] }>(
        `/admin/products?q=${encodeURIComponent(term.trim())}&limit=10&fields=id,title,thumbnail`,
        { method: 'GET' }
      ),
  });

/**
 * Los productos de una lista de ids, para abrir Correcciones con los AFECTADOS por un
 * hallazgo en vez de un buscador en blanco.
 *
 * `useProductSearch` no sirve para esto: busca por texto, y lo que llega desde AI
 * Visibility son ids. Sin esto, el operador que hace click en “Corregir con IA” sobre
 * 2.660 productos sin descripción aterriza en un campo vacío y tiene que adivinar por
 * cuál empezar.
 */
export const useProductsByIds = (ids: string[]) =>
  useQuery({
    queryKey: [...seoGeoQueryKey.list({ product_ids: ids.join(',') })],
    enabled: ids.length > 0,
    queryFn: () => {
      const qs = ids.map((id) => `id[]=${encodeURIComponent(id)}`).join('&');
      return sdk.client.fetch<{ products: ProductSearchHit[] }>(
        `/admin/products?${qs}&limit=${ids.length}&fields=id,title,thumbnail`,
        { method: 'GET' }
      );
    },
  });

export const useGenerateCorrections = () =>
  useMutation({
    mutationFn: (body: { product_id: string; gaps?: string[] }) =>
      sdk.client.fetch<CorrectionProposals>('/admin/seo-geo/corrections', { method: 'POST', body }),
  });

export const useApplyCorrections = () =>
  useMutation({
    mutationFn: (body: { product_id: string; approved: Record<string, unknown> }) =>
      sdk.client.fetch<{ ok: boolean }>('/admin/seo-geo/corrections/apply', { method: 'POST', body }),
  });

export interface SeoGeoConfig {
  crawl: { max_pages: number; max_product_pages: number; max_depth: number; concurrency: number; per_request_timeout_ms: number; respect_robots: boolean; use_sitemap: boolean; user_agent: string };
  engines: { technical: boolean; architecture: boolean; catalog: boolean; geo: boolean; commercial: boolean; performance: boolean };
  technical: Record<string, number>;
  geo_weights: Record<string, number>;
  geo_thresholds: Record<string, number>;
  open_graph: { site_name: string; title: string; description: string; image_url: string; image_alt: string; locale: string; twitter_card: 'summary_large_image' | 'summary'; twitter_site: string };
  simulator: { enabled: boolean; llm_model: string; embedding_model: string; top_k: number; min_similarity: number };
  automation: { enabled: boolean; frequency: 'off' | 'weekly' | 'monthly' };
}

export const useSeoConfig = () =>
  useQuery({
    queryKey: seoGeoQueryKey.detail('config'),
    queryFn: () => sdk.client.fetch<{ config: SeoGeoConfig }>('/admin/seo-geo/config', { method: 'GET' }),
  });

export const useUpdateSeoConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SeoGeoConfig>) =>
      sdk.client.fetch<{ config: SeoGeoConfig }>('/admin/seo-geo/config', { method: 'POST', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: seoGeoQueryKey.detail('config') }),
  });
};

export interface SeoKeyword {
  term: string;
  handle: string | null;
  question: string;
  product_count: number;
  covered: boolean;
}
export const useKeywords = () =>
  useQuery({
    queryKey: seoGeoQueryKey.detail('keywords'),
    queryFn: () => sdk.client.fetch<{ keywords: SeoKeyword[]; has_audit: boolean }>('/admin/seo-geo/keywords', { method: 'GET' }),
  });
