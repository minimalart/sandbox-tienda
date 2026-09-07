import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `dynamic_group.site_id` — los grupos dinámicos pasan a ser por tienda.
 *
 * Los logs de membresía cuelgan del grupo y heredan la tienda por la FK. Sin
 * backfill: los grupos existentes quedan en `NULL` = global, así que una instalación
 * mono-tienda no cambia en nada.
 */
export declare class Migration20260807170100DynamicGroups extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
