import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { SEO_GEO_MODULE } from '../index';
import type SeoGeoModuleService from '../service';
import { getSeoGeoConfig, mergeSeoGeoConfig, type SeoGeoConfig } from '../config';
import { crawlSite } from '../crawler/crawl';
import { runHtmlEngines, summarizeFindings, type EngineFinding } from '../engines';
import { isCrawlUsable, runCrawlHealthChecks, unscorableReason } from '../engines/crawl-health';
import { runGeoScoring } from '../geo/run-geo';
import { resolveStorefrontUrl } from './storefront-url';
import { resolveGateCookie } from './gate-access';
import type { FindingSeverity } from '../models';

const IMPACT_BY_SEVERITY: Record<FindingSeverity, number> = { critical: 90, warning: 50, info: 15 };

/** Aborto cooperativo: el usuario pausó/canceló la auditoría en curso. */
class AuditAbort extends Error {
  constructor(public target: 'paused' | 'cancelled') {
    super(`audit aborted: ${target}`);
  }
}

/**
 * Ejecuta una auditoría de punta a punta (PRD §5): resuelve la URL, crawlea el
 * storefront, corre los motores HTML (técnico + arquitectura), y persiste
 * páginas, enlaces y hallazgos con el SEO score agregado. Los motores de
 * catálogo/GEO se ejecutan en un paso aparte (Hito 4). Tolera fallas marcando la
 * auditoría como `failed` con el detalle.
 */
export async function runAudit(container: MedusaContainer, auditId: string): Promise<void> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  const audit = await service.retrieveSeoAudit(auditId);
  const cfg: SeoGeoConfig = audit.config ? mergeSeoGeoConfig(audit.config) : await getSeoGeoConfig(container);
  const baseUrl = (audit.base_url || resolveStorefrontUrl()).replace(/\/+$/, '');

  try {
    await service.updateSeoAudits({ id: auditId, base_url: baseUrl, config: cfg });
    await service.setStatus(auditId, 'running');
    await service.setPhase(auditId, 'discovery');

    // Llave del site gate, si la tienda auditada tiene la contraseña puesta. Se firma
    // por corrida y vive sólo en memoria: no entra en la config congelada, que se
    // guarda en la fila y se muestra entera en el admin. Sin ella, una tienda que
    // todavía no abrió al público —justo cuando conviene auditarla— devuelve la
    // pantalla de acceso y el crawl termina en una página.
    const cookie = await resolveGateCookie(container, baseUrl);
    if (cookie) {
      logger.info(`[seo-geo] auditoría ${auditId}: la tienda tiene site gate, se crawlea con la llave`);
    }

    // 1) Crawl (descubrimiento + fetch + parseo). El callback por lote hace de
    // heartbeat (bumpea updated_at) y de punto de aborto cooperativo: si el
    // usuario pausó/canceló, corta acá.
    await service.setPhase(auditId, 'crawl');
    const { pages } = await crawlSite(
      baseUrl,
      cfg.crawl,
      async (crawled, total) => {
        const fresh = await service.retrieveSeoAudit(auditId);
        if (fresh.status === 'paused' || fresh.status === 'cancelled') throw new AuditAbort(fresh.status);
        await service.setPhase(auditId, 'crawl', { pages_crawled: crawled, pages_total: total });
      },
      { cookie }
    );

    await assertNotAborted(service, auditId);

    // 2) Persistir páginas y obtener sus ids (para enlazar el grafo)
    await service.setPhase(auditId, 'analyze', { pages_crawled: pages.length, pages_total: pages.length });
    const pageRows = (await service.createSeoAuditPages(
      pages.map((p) => ({
        audit_id: auditId,
        url: p.url,
        status_code: p.status_code,
        fetch_class: p.fetch_class,
        response_time_ms: p.response_time_ms,
        content_type: p.content_type,
        canonical_url: p.canonical_url,
        canonical_header: p.canonical_header,
        robots_meta: p.robots_meta,
        x_robots_tag: p.x_robots_tag,
        is_indexable: p.is_indexable,
        in_sitemap: p.in_sitemap,
        title: p.title,
        meta_description: p.meta_description,
        og_title: p.og_title,
        og_description: p.og_description,
        og_image: p.og_image,
        h1_count: p.h1_count,
        h2_count: p.h2_count,
        h3_count: p.h3_count,
        h4_count: p.h4_count,
        h5_count: p.h5_count,
        h6_count: p.h6_count,
        heading_order: p.heading_order,
        word_count: p.word_count,
        content_hash: p.content_hash,
        images_total: p.images_total,
        images_missing_alt: p.images_missing_alt,
        internal_link_count: p.internal_link_count,
        external_link_count: p.external_link_count,
        has_structured_data: p.has_structured_data,
        structured_data_types: p.structured_data_types,
        hreflang_tags: p.hreflang_tags,
        crawl_depth: p.crawl_depth,
        page_type: p.page_type,
      })) as never
    )) as unknown as Array<{ id: string; url: string }>;

    const pageIdByUrl = new Map<string, string>();
    for (const row of pageRows) pageIdByUrl.set(row.url, row.id);

    // 3) Persistir el grafo de enlaces
    const linkRows: Array<Record<string, unknown>> = [];
    for (const p of pages) {
      const sourceId = pageIdByUrl.get(p.url);
      if (!sourceId) continue;
      for (const l of p.links) {
        linkRows.push({
          audit_id: auditId,
          source_page_id: sourceId,
          target_url: l.target_url,
          anchor: l.anchor,
          is_internal: l.is_internal,
          is_nofollow: l.is_nofollow,
        });
      }
    }
    if (linkRows.length) await service.createSeoAuditLinks(linkRows as never);

    // 4) Motores HTML (técnico + arquitectura) → hallazgos + SEO score
    await service.setPhase(auditId, 'score');
    const { findings: htmlFindings, seo_score } = runHtmlEngines(pages, cfg);

    // 4b) Motores basados en Medusa (catálogo + GEO): scoring de productos,
    // AI Visibility Score + snapshot para el historial, hallazgos agregados.
    let geoFindingsList: EngineFinding[] = [];
    let aiVisibility = null as Awaited<ReturnType<typeof runGeoScoring>>['aiVisibility'] | null;
    if (cfg.engines.catalog || cfg.engines.geo) {
      await assertNotAborted(service, auditId);
      const geo = await runGeoScoring(container, auditId, audit.sales_channel_id ?? null, cfg);
      geoFindingsList = geo.findings;
      aiVisibility = geo.aiVisibility;
    }

    // 4c) Salud del crawl. Corre SIEMPRE, aunque no haya ningún motor prendido:
    // es lo único que distingue "el sitio está sano" de "no se pudo mirar el
    // sitio". Va PRIMERO en la lista para que encabece la pantalla de Hallazgos.
    const healthFindings = runCrawlHealthChecks(pages);
    const findings = [...healthFindings, ...htmlFindings, ...geoFindingsList];
    const summary = summarizeFindings(findings);
    if (findings.length) {
      await service.createSeoFindings(
        findings.map((f) => ({
          audit_id: auditId,
          engine: f.engine,
          type: f.type,
          severity: f.severity,
          entity_type: f.entity_type ?? 'page',
          entity_id: f.entity_id ?? null,
          page_url: f.page_url ?? null,
          details: f.details ?? null,
          status: 'open' as const,
          impact: IMPACT_BY_SEVERITY[f.severity],
        }))
      );
    }

    // 5) Cierre.
    //
    // El score se publica SÓLO si se pudo medir. `computeSeoScore` arranca en 100
    // y RESTA penalidades, así que sin motores prendidos o sin páginas devuelve un
    // 100 que no significa "impecable" sino "no se miró nada" — y los dos se ven
    // igual en el dashboard. Cuando no es medible se guarda `null` (la UI muestra
    // "—") con el motivo en `error_summary`. La auditoría igual queda `completed`:
    // corrió entera, y sus hallazgos de crawl SON el resultado.
    const htmlEnginesRan = cfg.engines.technical || cfg.engines.architecture;
    const scorable = htmlEnginesRan && isCrawlUsable(pages);
    const reason = scorable ? null : unscorableReason(pages, htmlEnginesRan);

    await service.setPhase(auditId, 'finalize');
    await service.updateSeoAudits({
      id: auditId,
      seo_score: scorable ? seo_score : null,
      error_summary: reason ? { message: reason, unscored: true } : null,
      ai_visibility_score: aiVisibility?.score ?? null,
      ai_visibility_breakdown: aiVisibility?.breakdown ?? null,
      findings_summary: summary,
      pages_crawled: pages.length,
      pages_total: pages.length,
    });
    await service.setStatus(auditId, 'completed');
    logger.info(
      `[seo-geo] auditoría ${auditId} completada: ${pages.length} páginas, ${findings.length} hallazgos, SEO ${scorable ? seo_score : '— (sin medir)'}, AI Visibility ${aiVisibility?.score ?? '—'}`
    );
  } catch (e) {
    // Aborto cooperativo (pausa/cancelación): el estado ya lo fijó el endpoint;
    // sólo estampamos el cierre, sin marcar `failed`.
    if (e instanceof AuditAbort) {
      logger.info(`[seo-geo] auditoría ${auditId} abortada por el usuario (${e.target})`);
      await service.updateSeoAudits({ id: auditId, completed_at: new Date() }).catch(() => undefined);
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    logger.error(`[seo-geo] auditoría ${auditId} falló: ${message}`);
    await service
      .updateSeoAudits({ id: auditId, status: 'failed', completed_at: new Date(), error_summary: { message } })
      .catch(() => undefined);
  }
}

/** Lanza AuditAbort si el usuario pausó/canceló la auditoría entre fases. */
async function assertNotAborted(service: SeoGeoModuleService, auditId: string): Promise<void> {
  const fresh = await service.retrieveSeoAudit(auditId);
  if (fresh.status === 'paused' || fresh.status === 'cancelled') throw new AuditAbort(fresh.status);
}
