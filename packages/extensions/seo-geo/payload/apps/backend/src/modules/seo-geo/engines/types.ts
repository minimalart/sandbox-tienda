import type { FindingEngine, FindingSeverity } from '../models';

/** Hallazgo emitido por un motor, antes de persistirse como `seo_finding`. */
export type EngineFinding = {
  engine: FindingEngine;
  type: string;
  severity: FindingSeverity;
  entity_type?: 'page' | 'product' | 'category' | 'collection' | 'site';
  entity_id?: string | null;
  page_url?: string | null;
  details?: Record<string, unknown> | null;
};
