import { MedusaService } from '@medusajs/framework/utils';
import {
  SeoAudit,
  SeoAuditPage,
  SeoAuditLink,
  SeoFinding,
  SeoGeoProductScore,
  SeoAiVisibilitySnapshot,
  SeoGeoProductEmbedding,
  type AuditPhase,
  type AuditStatus,
} from './models';

class SeoGeoModuleService extends MedusaService({
  SeoAudit,
  SeoAuditPage,
  SeoAuditLink,
  SeoFinding,
  SeoGeoProductScore,
  SeoAiVisibilitySnapshot,
  SeoGeoProductEmbedding,
}) {
  /**
   * Actualiza fase y contadores de progreso de una auditoría en curso.
   * Best-effort para el reporte de avance; no valida transiciones.
   */
  async setPhase(
    auditId: string,
    phase: AuditPhase,
    progress?: { pages_crawled?: number; pages_total?: number }
  ): Promise<void> {
    await this.updateSeoAudits({
      id: auditId,
      current_phase: phase,
      ...(progress ?? {}),
    });
  }

  /** Transición de estado con timestamps de ciclo de vida. */
  async setStatus(auditId: string, status: AuditStatus): Promise<void> {
    const now = new Date();
    const patch: Record<string, unknown> = { id: auditId, status };
    if (status === 'running') patch.started_at = now;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      patch.completed_at = now;
    }
    await this.updateSeoAudits(patch);
  }

  /**
   * Borra (soft-delete) los datos parciales de una auditoría (páginas, enlaces,
   * hallazgos, scores GEO y snapshot) para poder re-correrla limpia sobre la
   * misma fila. Los índices únicos son parciales (`deleted_at IS NULL`), así que
   * el soft-delete evita colisiones al recrear.
   */
  async resetAuditData(auditId: string): Promise<void> {
    const takeAll = { take: null as unknown as number };
    const pages = await this.listSeoAuditPages({ audit_id: auditId }, takeAll);
    if (pages.length) await this.deleteSeoAuditPages(pages.map((p) => p.id));
    const links = await this.listSeoAuditLinks({ audit_id: auditId }, takeAll);
    if (links.length) await this.deleteSeoAuditLinks(links.map((l) => l.id));
    const findings = await this.listSeoFindings({ audit_id: auditId }, takeAll);
    if (findings.length) await this.deleteSeoFindings(findings.map((f) => f.id));
    const scores = await this.listSeoGeoProductScores({ audit_id: auditId }, takeAll);
    if (scores.length) await this.deleteSeoGeoProductScores(scores.map((s) => s.id));
    const snaps = await this.listSeoAiVisibilitySnapshots({ audit_id: auditId }, takeAll);
    if (snaps.length) await this.deleteSeoAiVisibilitySnapshots(snaps.map((s) => s.id));
  }

  /**
   * Re-encola una auditoría (reanudar tras pausar, o re-correr una
   * cancelada/fallida): limpia los datos parciales y la vuelve a `queued`
   * reseteando progreso/scores. El job la toma en el próximo tick.
   */
  async requeueAudit(auditId: string): Promise<void> {
    await this.resetAuditData(auditId);
    await this.updateSeoAudits({
      id: auditId,
      status: 'queued',
      current_phase: null,
      pages_crawled: 0,
      pages_total: 0,
      seo_score: null,
      ai_visibility_score: null,
      ai_visibility_breakdown: null,
      findings_summary: null,
      error_summary: null,
      started_at: null,
      completed_at: null,
    });
  }
}

export default SeoGeoModuleService;
