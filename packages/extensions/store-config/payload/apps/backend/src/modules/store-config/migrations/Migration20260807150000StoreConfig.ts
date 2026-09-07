import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `store_setting.site_id` — la configuración deja de ser una sola para la instancia.
 *
 * Las filas existentes quedan en `NULL`, que ahora significa "valor global": siguen
 * siendo el fallback de toda tienda que no defina el suyo. Por eso no hay backfill y
 * por eso el deploy no cambia nada — una instalación mono-tienda se comporta igual.
 *
 * El índice único viejo era sobre `key` a secas. Se reemplaza por DOS parciales:
 * en Postgres `NULL != NULL`, así que un único `UNIQUE (site_id, key)` dejaría pasar
 * dos filas globales con la misma clave, y `getSetting` devolvería cualquiera de las
 * dos según el plan. Aparecería meses después como "la configuración se revierte".
 */
export class Migration20260807150000StoreConfig extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "store_setting" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_setting_key_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_setting_key_global_unique"
         ON "store_setting" ("key") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_store_setting_site_key_unique"
         ON "store_setting" ("site_id", "key") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_store_setting_site" ON "store_setting" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_setting_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_setting_site_key_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_store_setting_key_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "store_setting" DROP COLUMN IF EXISTS "site_id";`);
  }
}
