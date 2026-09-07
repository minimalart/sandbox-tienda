import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `gift_card_settings.site_id` — la configuración de gift cards deja de ser singleton.
 *
 * La fila `NULL` sigue siendo la de siempre y pasa a ser el GLOBAL: el fallback de
 * toda tienda que no defina la suya. Sin backfill, sin cambio de comportamiento.
 *
 * El índice único viejo era sobre `singleton_key` a secas. Se reemplaza por DOS
 * parciales: en Postgres `NULL != NULL`, así que un único `UNIQUE (site_id,
 * singleton_key)` dejaría pasar dos filas globales y `getSettings` devolvería
 * cualquiera de las dos según el plan de ejecución.
 */
export declare class Migration20260807180000GiftCardExperience extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
