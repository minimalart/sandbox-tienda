import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `email_template.site_id` — cada tienda puede tener su propia versión de una plantilla.
 *
 * Las existentes quedan en `NULL` = GLOBAL: siguen siendo el fallback de toda tienda
 * que no defina la suya para esa clave. Sin backfill, sin cambio de comportamiento.
 *
 * El índice único viejo era sobre `key` a secas y no permite dos filas con la misma
 * clave. Se reemplaza por DOS parciales: en Postgres `NULL != NULL`, así que un único
 * `UNIQUE (site_id, key)` dejaría pasar dos globales con la misma clave y cuál gana
 * dependería del plan de ejecución.
 */
export class Migration20260807220000EmailTemplate extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "email_template" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_email_template_key_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_template_key_global_unique"
         ON "email_template" ("key") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_template_site_key_unique"
         ON "email_template" ("site_id", "key") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_template_site" ON "email_template" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_email_template_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_email_template_site_key_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_email_template_key_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "email_template" DROP COLUMN IF EXISTS "site_id";`);
  }
}
