import type { SiteScopeDescriptor } from '../../lib/multistore/scope';

/** Los grupos dinámicos son por tienda; `NULL` = global de la instancia. */
export const DYNAMIC_GROUP_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'site_column',
  table: 'dynamic_group',
  column: 'site_id',
  empty: 'all',
};

/** Los logs cuelgan del grupo: sin grupo son huérfanos. */
export const DYNAMIC_GROUP_LOG_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'dynamic_group_membership_log',
  fk: 'dynamic_group_id',
  parent: DYNAMIC_GROUP_SITE_SCOPE,
  empty: 'unassigned',
};
