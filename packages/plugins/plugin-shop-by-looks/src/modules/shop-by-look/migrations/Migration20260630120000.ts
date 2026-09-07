import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260630120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "shop_by_look" ("id" text not null, "title" text not null, "subtitle" text null, "cta_label" text null, "image_url" text not null, "image_alt" text null, "is_active" boolean not null default true, "sort_order" integer not null default 0, "placement" text not null default 'after_featured', "sales_channel_ids" jsonb null, "region_ids" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_by_look_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_deleted_at" ON "shop_by_look" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(
      `create table if not exists "shop_by_look_product" ("id" text not null, "product_id" text not null, "variant_id" text null, "pos_x" integer not null default 50, "pos_y" integer not null default 50, "sort_order" integer not null default 0, "look_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shop_by_look_product_pkey" primary key ("id"));`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_look_id" ON "shop_by_look_product" ("look_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_product_id" ON "shop_by_look_product" ("product_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_shop_by_look_product_deleted_at" ON "shop_by_look_product" ("deleted_at") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `alter table if exists "shop_by_look_product" add constraint "shop_by_look_product_look_id_foreign" foreign key ("look_id") references "shop_by_look" ("id") on update cascade on delete cascade;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shop_by_look_product" cascade;`);
    this.addSql(`drop table if exists "shop_by_look" cascade;`);
  }
}
