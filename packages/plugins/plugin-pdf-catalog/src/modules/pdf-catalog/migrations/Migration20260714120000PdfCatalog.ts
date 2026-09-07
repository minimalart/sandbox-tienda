import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260714120000PdfCatalog extends Migration {
  override async up(): Promise<void> {
    // ── pdf_catalog ──────────────────────────────────────────────────────────
    this.addSql(
      `create table if not exists "pdf_catalog" ("id" text not null, "name" text not null, "pdf_url" text not null, "pdf_file_id" text null, "pages" integer not null default 0, "published" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_deleted_at" ON "pdf_catalog" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // ── pdf_catalog_hotspot ──────────────────────────────────────────────────
    this.addSql(
      `create table if not exists "pdf_catalog_hotspot" ("id" text not null, "type" text check ("type" in ('product', 'video', 'text')) not null default 'product', "page_index" integer not null default 0, "pos_x" integer not null default 50, "pos_y" integer not null default 50, "product_id" text null, "variant_id" text null, "data" jsonb null, "sort_order" integer not null default 0, "catalog_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_hotspot_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_catalog_id" ON "pdf_catalog_hotspot" ("catalog_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_product_id" ON "pdf_catalog_hotspot" ("product_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_deleted_at" ON "pdf_catalog_hotspot" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `alter table if exists "pdf_catalog_hotspot" add constraint "pdf_catalog_hotspot_catalog_id_foreign" foreign key ("catalog_id") references "pdf_catalog" ("id") on update cascade on delete cascade;`
    );

    // ── pdf_catalog_channel (una activación viva por sales channel) ───────────
    this.addSql(
      `create table if not exists "pdf_catalog_channel" ("id" text not null, "sales_channel_id" text not null, "catalog_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_channel_pkey" primary key ("id"));`
    );
    // UNIQUE parcial: garantiza "un solo catálogo activo por sales channel".
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_sales_channel_id_unique" ON "pdf_catalog_channel" ("sales_channel_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_catalog_id" ON "pdf_catalog_channel" ("catalog_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_deleted_at" ON "pdf_catalog_channel" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `alter table if exists "pdf_catalog_channel" add constraint "pdf_catalog_channel_catalog_id_foreign" foreign key ("catalog_id") references "pdf_catalog" ("id") on update cascade on delete cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pdf_catalog_channel" cascade;`);
    this.addSql(`drop table if exists "pdf_catalog_hotspot" cascade;`);
    this.addSql(`drop table if exists "pdf_catalog" cascade;`);
  }
}
