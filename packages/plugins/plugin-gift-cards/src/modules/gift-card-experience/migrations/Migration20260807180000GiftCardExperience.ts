import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `gift_card_settings.site_id` — la configuración de gift cards deja de ser singleton.
 *
 * La fila `NULL` sigue siendo la de siempre y pasa a ser el GLOBAL: el fallback de
 * toda tienda que no defina la suya. Sin backfill, sin cambio de comportamiento.
 *
 * El índice único viejo era sobre `singleton_key` a secas. Se reemplaza por DOS
 * parciales: en Postgres `NULL != NULL`, así que un único `UNIQUE (site_id,
 * singleton_key)` dejaría pasar dos filas globales y `getSettings` devolvería
 * cualquiera de las dos según el plan de ejecución.
 */
export class Migration20260807180000GiftCardExperience extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_singleton_key_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_settings_global_unique"
         ON "gift_card_settings" ("singleton_key") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_settings_site_unique"
         ON "gift_card_settings" ("site_id", "singleton_key") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_settings_site" ON "gift_card_settings" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_site_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_settings_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_settings" DROP COLUMN IF EXISTS "site_id";`);
  }
}
