"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260714120000PdfCatalog = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260714120000PdfCatalog extends migrations_1.Migration {
    async up() {
        // ── pdf_catalog ──────────────────────────────────────────────────────────
        this.addSql(`create table if not exists "pdf_catalog" ("id" text not null, "name" text not null, "pdf_url" text not null, "pdf_file_id" text null, "pages" integer not null default 0, "published" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_deleted_at" ON "pdf_catalog" ("deleted_at") WHERE deleted_at IS NULL;`);
        // ── pdf_catalog_hotspot ──────────────────────────────────────────────────
        this.addSql(`create table if not exists "pdf_catalog_hotspot" ("id" text not null, "type" text check ("type" in ('product', 'video', 'text')) not null default 'product', "page_index" integer not null default 0, "pos_x" integer not null default 50, "pos_y" integer not null default 50, "product_id" text null, "variant_id" text null, "data" jsonb null, "sort_order" integer not null default 0, "catalog_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_hotspot_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_catalog_id" ON "pdf_catalog_hotspot" ("catalog_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_product_id" ON "pdf_catalog_hotspot" ("product_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_hotspot_deleted_at" ON "pdf_catalog_hotspot" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`alter table if exists "pdf_catalog_hotspot" add constraint "pdf_catalog_hotspot_catalog_id_foreign" foreign key ("catalog_id") references "pdf_catalog" ("id") on update cascade on delete cascade;`);
        // ── pdf_catalog_channel (una activación viva por sales channel) ───────────
        this.addSql(`create table if not exists "pdf_catalog_channel" ("id" text not null, "sales_channel_id" text not null, "catalog_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pdf_catalog_channel_pkey" primary key ("id"));`);
        // UNIQUE parcial: garantiza "un solo catálogo activo por sales channel".
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_sales_channel_id_unique" ON "pdf_catalog_channel" ("sales_channel_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_catalog_id" ON "pdf_catalog_channel" ("catalog_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pdf_catalog_channel_deleted_at" ON "pdf_catalog_channel" ("deleted_at") WHERE deleted_at IS NULL;`);
        this.addSql(`alter table if exists "pdf_catalog_channel" add constraint "pdf_catalog_channel_catalog_id_foreign" foreign key ("catalog_id") references "pdf_catalog" ("id") on update cascade on delete cascade;`);
    }
    async down() {
        this.addSql(`drop table if exists "pdf_catalog_channel" cascade;`);
        this.addSql(`drop table if exists "pdf_catalog_hotspot" cascade;`);
        this.addSql(`drop table if exists "pdf_catalog" cascade;`);
    }
}
exports.Migration20260714120000PdfCatalog = Migration20260714120000PdfCatalog;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MTQxMjAwMDBQZGZDYXRhbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvcGRmLWNhdGFsb2cvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcxNDEyMDAwMFBkZkNhdGFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFLE1BQWEsaUNBQWtDLFNBQVEsc0JBQVM7SUFDckQsS0FBSyxDQUFDLEVBQUU7UUFDZiw0RUFBNEU7UUFDNUUsSUFBSSxDQUFDLE1BQU0sQ0FDVCxrYUFBa2EsQ0FDbmEsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUhBQW1ILENBQ3BILENBQUM7UUFFRiw0RUFBNEU7UUFDNUUsSUFBSSxDQUFDLE1BQU0sQ0FDVCxxbEJBQXFsQixDQUN0bEIsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUlBQW1JLENBQ3BJLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG1JQUFtSSxDQUNwSSxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxtSUFBbUksQ0FDcEksQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QscU1BQXFNLENBQ3RNLENBQUM7UUFFRiw2RUFBNkU7UUFDN0UsSUFBSSxDQUFDLE1BQU0sQ0FDVCxpVUFBaVUsQ0FDbFUsQ0FBQztRQUNGLHlFQUF5RTtRQUN6RSxJQUFJLENBQUMsTUFBTSxDQUNULDZKQUE2SixDQUM5SixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxtSUFBbUksQ0FDcEksQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUlBQW1JLENBQ3BJLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHFNQUFxTSxDQUN0TSxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMscURBQXFELENBQUMsQ0FBQztRQUNuRSxJQUFJLENBQUMsTUFBTSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDbkUsSUFBSSxDQUFDLE1BQU0sQ0FBQyw2Q0FBNkMsQ0FBQyxDQUFDO0lBQzdELENBQUM7Q0FDRjtBQW5ERCw4RUFtREMifQ==