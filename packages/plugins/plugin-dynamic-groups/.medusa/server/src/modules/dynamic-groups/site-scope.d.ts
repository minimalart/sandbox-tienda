import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
/** Los grupos dinámicos son por tienda; `NULL` = global de la instancia. */
export declare const DYNAMIC_GROUP_SITE_SCOPE: SiteScopeDescriptor;
/** Los logs cuelgan del grupo: sin grupo son huérfanos. */
export declare const DYNAMIC_GROUP_LOG_SITE_SCOPE: SiteScopeDescriptor;
