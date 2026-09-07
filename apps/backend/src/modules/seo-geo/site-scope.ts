import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/**
 * Las auditorías de SEO son POR CANAL desde el día uno: `seo_audit.sales_channel_id`
 * ya existía. Lo que faltaba era que el admin lo usara.
 *
 * `empty: 'all'` porque una auditoría sin canal es de la instancia entera (una corrida
 * vieja, o una lanzada antes de que hubiera tiendas) y esconderla haría desaparecer
 * el histórico justo cuando alguien lo va a comparar.
 */
export const SEO_AUDIT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'seo_audit',
  column: 'sales_channel_id',
  empty: 'all',
};

export const SEO_AI_VISIBILITY_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'channel_column',
  table: 'seo_ai_visibility_snapshot',
  column: 'sales_channel_id',
  empty: 'all',
};

/**
 * Los hallazgos cuelgan de su auditoría. `empty: 'unassigned'` porque un hallazgo sin
 * auditoría es huérfano — no existe forma de generarlo salvo un borrado a medias.
 */
export const SEO_FINDING_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'seo_finding',
  fk: 'audit_id',
  parent: SEO_AUDIT_SITE_SCOPE,
  empty: 'unassigned',
};
