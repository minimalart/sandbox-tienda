import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `ga4_settings.site_id` — cada tienda puede medir en su propia propiedad de GA4.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no configure la suya, y la que se sembró desde las env. Sin backfill.
 */
export declare class Migration20260807210000Ga4 extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
