import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `blog_settings.site_id` — la config del blog deja de ser singleton.
 *
 * La fila existente queda en `NULL` = GLOBAL, el fallback de toda tienda sin config
 * propia. Sin backfill.
 */
export class Migration20260807200100Blog extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "blog_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_blog_settings_site_unique"
         ON "blog_settings" ("site_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_blog_settings_site_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "blog_settings" DROP COLUMN IF EXISTS "site_id";`);
  }
}
