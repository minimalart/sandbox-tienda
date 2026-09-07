import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `loyalty_program.site_id` — el programa de fidelidad deja de ser uno por instancia.
 *
 * Sólo el programa lleva la columna. Sus tiers, rewards, campaigns y earn-rules ya
 * apuntan al programa por FK y heredan la tienda de ahí; los grants llegan por
 * `reward`. Denormalizar `site_id` en las cinco tablas habría dejado cinco lugares
 * donde una escritura puede olvidarse de setearlo.
 *
 * Sin backfill: los programas existentes quedan en `NULL` = global, así que una
 * instalación mono-tienda no cambia en nada.
 */
export declare class Migration20260807160000Loyalty extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
