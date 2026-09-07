import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `blog_category.site_id` — las categorías del blog pueden ser por tienda.
 *
 * Sin backfill: las existentes quedan en `NULL` = taxonomía compartida. Esconderlas
 * dejaría posts publicados apuntando a una categoría que el operador no ve en su
 * listado, y el post se rompería sin que nada avise.
 */
export declare class Migration20260807230000BlogCategory extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
