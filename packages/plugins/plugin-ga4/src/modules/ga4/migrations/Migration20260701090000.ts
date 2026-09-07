import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260701090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "ga4_builtin_setting" ("id" text not null, "builtin_key" text not null, "is_active" boolean not null default true, "ga4_event_name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ga4_builtin_setting_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_deleted_at" ON "ga4_builtin_setting" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_key_unique" ON "ga4_builtin_setting" ("builtin_key") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ga4_builtin_setting" cascade;`);
  }
}
