import { Migration } from '@medusajs/framework/mikro-orm/migrations';
/**
 * Mueve la config de GA4 de env vars a la DB (tabla ga4_settings, single-row) y
 * elimina el log de eventos (ga4_event_log): los hits ya viven en GA4, persistirlos
 * solo infla la DB. El servicio siembra ga4_settings desde las env en el primer acceso.
 *
 * Renombrada de `Migration20260702120000` para cumplir la convención de sufijo de
 * módulo que exige `migration-names.test.ts`. Todo el `up()` es idempotente
 * (`if [not] exists`), así que en una DB donde ya se aplicó el nombre viejo el
 * nombre nuevo re-corre como no-op (la entrada vieja queda huérfana pero inocua:
 * umzug solo ejecuta pendientes = archivos − aplicadas, nunca al revés).
 */
export declare class Migration20260702120000Ga4 extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
