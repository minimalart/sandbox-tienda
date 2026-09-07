import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `site_id` en el mapeo de eventos y en los builtins de GA4.
 *
 * Las filas existentes quedan en `NULL` = GLOBAL: el mapeo por defecto que comparten
 * todas las tiendas. Una marca puede definir el suyo para una clave sin tocárselo a las
 * demás.
 *
 * Los únicos viejos no contemplaban la columna. Se parten en DOS parciales cada uno:
 * en Postgres `NULL != NULL`, así que un único índice sobre `(site_id, …)` dejaría
 * pasar dos globales idénticos y cuál gana dependería del plan de ejecución.
 */
export declare class Migration20260807250000Ga4Mappings extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
