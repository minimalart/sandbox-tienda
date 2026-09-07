import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `minimum_purchase.site_id` — el mínimo de compra puede ser por tienda.
 *
 * Es un log append-only: la columna NO reescribe historia. Los registros existentes
 * quedan en `NULL` y siguen siendo el mínimo GLOBAL; una tienda que define el suyo
 * empieza su propia serie desde ese momento, y mientras no lo haga hereda el global.
 */
export class Migration20260807270000MinimumPurchase extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "minimum_purchase" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_minimum_purchase_site" ON "minimum_purchase" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_minimum_purchase_site";`);
    this.addSql(`ALTER TABLE IF EXISTS "minimum_purchase" DROP COLUMN IF EXISTS "site_id";`);
  }
}
