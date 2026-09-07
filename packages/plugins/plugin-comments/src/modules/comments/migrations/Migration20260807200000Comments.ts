import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `comment_settings.site_id` — la config de moderación deja de ser singleton.
 *
 * La fila existente queda en `NULL` y pasa a ser el GLOBAL: el fallback de toda tienda
 * que no defina la suya. Sin backfill, sin cambio de comportamiento.
 */
export class Migration20260807200000Comments extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "comment_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_comment_settings_site_unique"
         ON "comment_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_comment_settings_site_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "comment_settings" DROP COLUMN IF EXISTS "site_id";`);
  }
}
