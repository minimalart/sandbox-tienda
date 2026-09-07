"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260702120000Ga4 = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
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
class Migration20260702120000Ga4 extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "ga4_settings" ("id" text not null, "measurement_id" text null, "api_secret" text null, "gtm_id" text null, "debug" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_settings_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ga4_settings_deleted_at" ON "ga4_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`drop table if exists "ga4_event_log" cascade;`);
    }
    async down() {
        this.addSql(`drop table if exists "ga4_settings" cascade;`);
        this.addSql(`create table if not exists "ga4_event_log" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "client_id" text null, "payload" jsonb null, "status" text check ("status" in ('sent', 'failed', 'skipped')) not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_log_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ga4_event_log_deleted_at" ON "ga4_event_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
}
exports.Migration20260702120000Ga4 = Migration20260702120000Ga4;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDIxMjAwMDBHYTQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9nYTQvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcwMjEyMDAwMEdhNC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7Ozs7R0FVRztBQUNILE1BQWEsMEJBQTJCLFNBQVEsc0JBQVM7SUFDOUMsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULDRYQUE0WCxDQUM3WCxDQUFDO1FBRUYsSUFBSSxDQUFDLE1BQU0sQ0FDVCxxSEFBcUgsQ0FDdEgsQ0FBQztRQUVGLElBQUksQ0FBQyxNQUFNLENBQUMsK0NBQStDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRVEsS0FBSyxDQUFDLElBQUk7UUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1FBRTVELElBQUksQ0FBQyxNQUFNLENBQ1QsK2JBQStiLENBQ2hjLENBQUM7UUFFRixJQUFJLENBQUMsTUFBTSxDQUNULHVIQUF1SCxDQUN4SCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBeEJELGdFQXdCQyJ9