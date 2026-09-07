import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `comment_settings.site_id` — la config de moderación deja de ser singleton.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no defina la suya. Sin backfill, sin cambio de comportamiento.
 */
export declare class Migration20260807200000Comments extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
