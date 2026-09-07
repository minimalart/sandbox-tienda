import type { EngineFinding } from './types';

/**
 * Motor de Performance — STUB (PRD §9, roadmap V3). Core Web Vitals reales
 * (LCP/CLS/INP) requieren PageSpeed Insights API o Lighthouse en Node, que se
 * difirieron del MVP para no bloquear por credenciales. Hoy devuelve vacío; la
 * integración externa se cablea en V3 sin cambiar el resto del pipeline.
 */
export function runPerformanceEngine(): EngineFinding[] {
  return [];
}
