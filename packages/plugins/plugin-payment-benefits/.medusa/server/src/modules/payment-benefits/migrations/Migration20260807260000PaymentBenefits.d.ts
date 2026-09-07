import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * `payment_method_catalog.site_id` — el catálogo de medios de pago sigue a la cuenta.
 *
 * Desde que las credenciales de MercadoPago son por tienda, dos tiendas con cuentas
 * distintas pueden tener medios habilitados distintos. Mostrar el catálogo de una en la
 * otra le ofrece al comprador un medio que su checkout va a rechazar.
 *
 * Las filas existentes quedan en `NULL` = GLOBAL, el sincronizado con las credenciales
 * de entorno. Sin backfill.
 */
export declare class Migration20260807260000PaymentBenefits extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
