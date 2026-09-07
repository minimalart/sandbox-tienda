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
export class Migration20260702120000Ga4 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "ga4_settings" ("id" text not null, "measurement_id" text null, "api_secret" text null, "gtm_id" text null, "debug" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_settings_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_settings_deleted_at" ON "ga4_settings" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`drop table if exists "ga4_event_log" cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ga4_settings" cascade;`);

    this.addSql(
      `create table if not exists "ga4_event_log" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "client_id" text null, "payload" jsonb null, "status" text check ("status" in ('sent', 'failed', 'skipped')) not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_event_log_deleted_at" ON "ga4_event_log" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }
}
