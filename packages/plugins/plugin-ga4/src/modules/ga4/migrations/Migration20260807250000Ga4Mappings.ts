import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `site_id` en el mapeo de eventos y en los builtins de GA4.
 *
 * Las filas existentes quedan en `NULL` = GLOBAL: el mapeo por defecto que comparten
 * todas las tiendas. Una marca puede definir el suyo para una clave sin tocárselo a las
 * demás.
 *
 * Los únicos viejos no contemplaban la columna. Se parten en DOS parciales cada uno:
 * en Postgres `NULL != NULL`, así que un único índice sobre `(site_id, …)` dejaría
 * pasar dos globales idénticos y cuál gana dependería del plan de ejecución.
 */
export class Migration20260807250000Ga4Mappings extends Migration {
  override async up(): Promise<void> {
    for (const table of ['ga4_event_mapping', 'ga4_builtin_setting']) {
      this.addSql(`ALTER TABLE IF EXISTS "${table}" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
      this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_${table}_site" ON "${table}" ("site_id");`);
    }

    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_event_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_global_unique"
         ON "ga4_event_mapping" ("medusa_event", "ga4_event_name")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_event_mapping_site_unique"
         ON "ga4_event_mapping" ("site_id", "medusa_event", "ga4_event_name")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );

    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_key_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_global_unique"
         ON "ga4_builtin_setting" ("builtin_key")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ga4_builtin_setting_site_unique"
         ON "ga4_builtin_setting" ("site_id", "builtin_key")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_site_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_builtin_setting_global_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_site_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_ga4_event_mapping_global_unique";`);
    for (const table of ['ga4_event_mapping', 'ga4_builtin_setting']) {
      this.addSql(`DROP INDEX IF EXISTS "IDX_${table}_site";`);
      this.addSql(`ALTER TABLE IF EXISTS "${table}" DROP COLUMN IF EXISTS "site_id";`);
    }
  }
}
