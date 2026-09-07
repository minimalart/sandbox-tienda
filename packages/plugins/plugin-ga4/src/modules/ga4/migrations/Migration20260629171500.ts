import { Migration } from '@medusajs/framework/mikro-orm/migrations';

// NOTA: nombre con timestamp único (20260629171500). El nombre original
// (20260629120000) colisionaba con una migración de ai-assistant y MikroORM,
// que trackea por nombre global, la daba por aplicada y salteaba esta — por eso
// ga4_event_mapping/ga4_event_log nunca se creaban.
export class Migration20260629171500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "ga4_event_mapping" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "is_active" boolean not null default true, "description" text null, "param_mappings" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_mapping_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_deleted_at" ON "ga4_event_mapping" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_event_unique" ON "ga4_event_mapping" ("medusa_event", "ga4_event_name") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "ga4_event_log" ("id" text not null, "medusa_event" text not null, "ga4_event_name" text not null, "client_id" text null, "payload" jsonb null, "status" text check ("status" in ('sent', 'failed', 'skipped')) not null, "error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_event_log_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_event_log_deleted_at" ON "ga4_event_log" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ga4_event_mapping" cascade;`);

    this.addSql(`drop table if exists "ga4_event_log" cascade;`);
  }
}
