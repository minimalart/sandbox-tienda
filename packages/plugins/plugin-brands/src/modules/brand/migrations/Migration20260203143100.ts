import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260203143100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "product_product_brand_brand" ("id" text not null, "product_id" text not null, "brand_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_product_brand_brand_pkey" primary key ("id"));`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_product_id" ON "product_product_brand_brand" ("product_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_brand_id" ON "product_product_brand_brand" ("brand_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_product_brand_link_deleted_at" ON "product_product_brand_brand" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_brand_link_unique" ON "product_product_brand_brand" ("product_id", "brand_id") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `ALTER TABLE "product_product_brand_brand" ADD CONSTRAINT "product_product_brand_brand_brand_id_foreign" FOREIGN KEY ("brand_id") REFERENCES "brand" ("id") ON UPDATE CASCADE ON DELETE CASCADE;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_product_brand_brand" cascade;`);
  }
}
