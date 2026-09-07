import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `blog_category.site_id` — las categorías del blog pueden ser por tienda.
 *
 * Sin backfill: las existentes quedan en `NULL` = taxonomía compartida. Esconderlas
 * dejaría posts publicados apuntando a una categoría que el operador no ve en su
 * listado, y el post se rompería sin que nada avise.
 */
export class Migration20260807230000BlogCategory extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "blog_category" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_blog_category_site" ON "blog_category" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_blog_category_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "blog_category" DROP COLUMN IF EXISTS "site_id";`);
  }
}
