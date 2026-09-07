import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260604140711 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_product_id_product_variant_id_unique";`);
    this.addSql(`drop index if exists "IDX_wishlist_item_wishlist_id_product_id_unique";`);

    this.addSql(`alter table if exists "wishlist_item" add column if not exists "product_variant_id" text not null, add column if not exists "quantity" integer not null default 1;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_product_id_product_variant_id_unique" ON "wishlist_item" ("wishlist_id", "product_id", "product_variant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_wishlist_item_wishlist_id_product_id_product_variant_id_unique";`);
    this.addSql(`alter table if exists "wishlist_item" drop column if exists "product_variant_id", drop column if exists "quantity";`);

    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_product_id_unique" ON "wishlist_item" ("wishlist_id", "product_id") WHERE deleted_at IS NULL;`);
  }

}
