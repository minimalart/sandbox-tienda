import type { CrawledPage } from '../crawler/types';
import type { SeoGeoConfig } from '../config';
import type { EngineFinding } from './types';
import { runTechnicalEngine } from './technical';
import { runArchitectureEngine } from './architecture';

export type { EngineFinding } from './types';

export type FindingsSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
  by_engine: Record<string, number>;
  by_type: Record<string, number>;
};

export type EngineRunResult = {
  findings: EngineFinding[];
  seo_score: number;
  summary: FindingsSummary;
};

/**
 * Corre los motores basados en el crawl HTML (técnico + arquitectura) según los
 * toggles de config, agrega los hallazgos y calcula un SEO score 0-100. Los
 * motores de catálogo/GEO (que leen Medusa) se agregan en el Hito 4.
 */
export function runHtmlEngines(pages: CrawledPage[], cfg: SeoGeoConfig): EngineRunResult {
  const findings: EngineFinding[] = [];
  if (cfg.engines.technical) findings.push(...runTechnicalEngine(pages, cfg.technical));
  if (cfg.engines.architecture) findings.push(...runArchitectureEngine(pages));

  return {
    findings,
    seo_score: computeSeoScore(pages, findings),
    summary: summarize(findings),
  };
}

/** Penalización por severidad para el score. */
const SEVERITY_WEIGHT: Record<string, number> = { critical: 5, warning: 2, info: 0.3 };

/**
 * Penalidad por página a la que el score vale ~37 (100/e). Es la ESCALA de la curva:
 * más chica, más castigo. No es un umbral — con el decaimiento no hay saturación.
 */
const SCORE_SCALE = 5.6;

/**
 * SEO score 0-100 por decaimiento exponencial de la penalidad media por página.
 * Determinista, sin LLM.
 *
 * ANTES era una rampa lineal recortada — `100 - (perPage / 2.5) * 100` con clamp en 0 —
 * y por lo tanto SATURABA en 2.5 de penalidad por página: medio hallazgo crítico por
 * página, o 1,25 warnings. Cualquier tienda real pasa eso de largo sin esfuerzo (un
 * title largo más una imagen sin alt en cada PDP ya son 4 puntos), así que el score
 * publicaba 0 y ahí se quedaba. Medido sobre tres auditorías de la MISMA tienda: 6,1 /
 * 9,9 / 28,5 puntos por página — tres estados muy distintos, los tres publicados como 0.
 *
 * Un número que no distingue no informa, y sobre todo no muestra PROGRESO, que es para
 * lo único que se mira un score. Con el decaimiento baja rápido al principio y sólo se
 * acerca al piso en una catástrofe: 0 → 100, 1 → 84, 2 → 70, 2.5 → 64, 6 → 34,
 * 10 → 17, 28 → 1.
 *
 * Las auditorías VIEJAS conservan el score que guardaron: esto no recalcula nada hacia
 * atrás, así que un 0 histórico no es comparable contra los números nuevos.
 */
export function computeSeoScore(pages: CrawledPage[], findings: EngineFinding[]): number {
  const n = Math.max(1, pages.length);
  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_WEIGHT[f.severity] ?? 1;
  const perPage = penalty / n;
  const score = 100 * Math.exp(-perPage / SCORE_SCALE);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function summarizeFindings(findings: EngineFinding[]): FindingsSummary {
  return summarize(findings);
}

function summarize(findings: EngineFinding[]): FindingsSummary {
  const s: FindingsSummary = { total: findings.length, critical: 0, warning: 0, info: 0, by_engine: {}, by_type: {} };
  for (const f of findings) {
    s[f.severity] += 1;
    s.by_engine[f.engine] = (s.by_engine[f.engine] ?? 0) + 1;
    s.by_type[f.type] = (s.by_type[f.type] ?? 0) + 1;
  }
  return s;
}
