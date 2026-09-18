import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `product_sales_mode`: modo de venta de un Product dentro de una tienda
 * (PRD Bundles V2 §5).
 *
 * La tabla nace VACÍA y eso es parte del diseño: la ausencia de fila significa
 * `standalone_and_bundle`, que es lo que todos los productos hacen hoy. Sin
 * backfill, el deploy no cambia el comportamiento de ninguna tienda hasta que
 * alguien configure un producto a mano.
 *
 * El único parcial (ignorando borrados) es lo que impide dos modos distintos
 * para el mismo par producto/tienda; el segundo índice es el que usa el filtro
 * caliente del storefront ("qué productos oculto en esta tienda").
 *
 * Idempotente (IF NOT EXISTS) para convivir con `ensure-tables.ts`, que corre el
 * mismo DDL en cada arranque — ver [[deploy-migrations-not-auto-applied]].
 */
export class Migration20260917120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "product_sales_mode" (
        "id" text not null,
        "product_id" text not null,
        "site_id" text not null,
        "sales_mode" text not null default 'standalone_and_bundle',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "product_sales_mode_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create unique index if not exists "IDX_product_sales_mode_product_site_unique" on "product_sales_mode" ("product_id", "site_id") where deleted_at is null;`
    );
    this.addSql(
      `create index if not exists "IDX_product_sales_mode_site_mode" on "product_sales_mode" ("site_id", "sales_mode") where deleted_at is null;`
    );
    this.addSql(
      `create index if not exists "IDX_product_sales_mode_deleted_at" on "product_sales_mode" ("deleted_at") where deleted_at is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_sales_mode";`);
  }
}
