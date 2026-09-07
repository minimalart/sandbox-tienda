import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `blog_settings.site_id` — la config del blog deja de ser singleton.
 *
 * La fila existente queda en `NULL` = GLOBAL, el fallback de toda tienda sin config
 * propia. Sin backfill.
 */
export declare class Migration20260807200100Blog extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
