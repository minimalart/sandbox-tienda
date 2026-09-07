import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Re-aplicación idempotente de las tablas de shop-by-look.
 *
 * La migración original `Migration20260630120000` quedó REGISTRADA como aplicada
 * en `mikro_orm_migrations` pero la tabla `shop_by_look` no existía en prod
 * (típicamente por un drop manual o un restore de la DB anterior a esa tabla), y
 * `db:migrate` ya no la vuelve a correr al verla "aplicada". Esta migración tiene
 * un nombre nuevo (pendiente) y recrea las tablas con `IF NOT EXISTS`, así en el
 * próximo deploy quedan creadas sin tocar la consola. Segura de re-correr.
 */
export declare class Migration20260630210000 extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
