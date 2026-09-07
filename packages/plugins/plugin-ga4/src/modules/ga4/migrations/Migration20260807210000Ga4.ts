import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `ga4_settings.site_id` — cada tienda puede medir en su propia propiedad de GA4.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no configure la suya, y la que se sembró desde las env. Sin backfill.
 */
export class Migration20260807210000Ga4 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "ga4_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_settings_site_unique"
         ON "ga4_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_settings_site_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "ga4_settings" DROP COLUMN IF EXISTS "site_id";`);
  }
}
