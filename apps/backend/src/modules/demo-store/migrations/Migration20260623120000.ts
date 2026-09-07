import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260623120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "demo_store" ("id" text not null, "name" text not null, "slug" text not null, "template_code" text not null default 'supermercado', "country_code" text not null, "currency_code" text not null, "locale" text not null default 'es', "source_type" text check ("source_type" in ('woocommerce', 'vtex', 'shopify')) not null, "source_url" text not null, "source_config" jsonb null, "target_count" integer null, "sales_channel_id" text null, "region_id" text null, "stock_location_id" text null, "status" text check ("status" in ('draft', 'provisioning', 'importing', 'ready', 'failed')) not null default 'draft', "theme" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "demo_store_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_demo_store_slug_unique" ON "demo_store" ("slug") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_demo_store_deleted_at" ON "demo_store" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "demo_import_job" ("id" text not null, "source_type" text check ("source_type" in ('woocommerce', 'vtex', 'shopify')) not null, "source_url" text not null, "target_count" integer null, "status" text check ("status" in ('pending', 'running', 'completed', 'failed')) not null default 'pending', "total_products" integer not null default 0, "fetched_products" integer not null default 0, "imported_products" integer not null default 0, "skipped_products" integer not null default 0, "failed_products" integer not null default 0, "duration_ms" integer not null default 0, "error_log" jsonb null, "run_log" jsonb null, "started_at" timestamptz null, "finished_at" timestamptz null, "demo_store_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "demo_import_job_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_demo_import_job_demo_store_id" ON "demo_import_job" ("demo_store_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_demo_import_job_deleted_at" ON "demo_import_job" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `alter table if exists "demo_import_job" drop constraint if exists "demo_import_job_demo_store_id_foreign";`
    );
    this.addSql(
      `alter table if exists "demo_import_job" add constraint "demo_import_job_demo_store_id_foreign" foreign key ("demo_store_id") references "demo_store" ("id") on update cascade on delete cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "demo_import_job" cascade;`);
    this.addSql(`drop table if exists "demo_store" cascade;`);
  }
}
