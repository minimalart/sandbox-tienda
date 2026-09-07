import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Agrega `hidden` a ga4_builtin_setting: permite "borrar" (ocultar) un evento
 * ecommerce built-in. Oculto = sale de la lista y nunca dispara; es reversible
 * (restaurar) porque el catálogo vive en código y no se puede recrear de cero.
 *
 * Renombrada de `Migration20260702130000` para cumplir la convención de sufijo de
 * módulo que exige `migration-names.test.ts`. El `up()` es idempotente
 * (`add column if not exists`), así que re-correr bajo el nombre nuevo en una DB
 * donde ya se aplicó el nombre viejo es un no-op.
 */
export declare class Migration20260702130000Ga4 extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
