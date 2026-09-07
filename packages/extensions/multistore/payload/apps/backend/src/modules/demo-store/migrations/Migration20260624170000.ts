import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260624170000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "demo_store" add column if not exists "target_count" integer null;`);
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "target_count" integer null;`);
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "fetched_products" integer not null default 0;`);
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "skipped_products" integer not null default 0;`);
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "duration_ms" integer not null default 0;`);
    this.addSql(`alter table if exists "demo_import_job" add column if not exists "run_log" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "run_log";`);
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "duration_ms";`);
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "skipped_products";`);
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "fetched_products";`);
    this.addSql(`alter table if exists "demo_import_job" drop column if exists "target_count";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "target_count";`);
  }
}
