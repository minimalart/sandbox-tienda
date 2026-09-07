import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `site_setting` / `site_setting_revision` — configuración por tienda, versionada.
 *
 * Reemplaza a `site_manager_setting`, que se va con la extensión "Sitio". Nace vacía
 * en vez de migrarse: `site_id` existe desde la primera fila y no hay que decidir qué
 * significa el `NULL` de las filas viejas. El único dato real que vivía en la tabla
 * anterior es el namespace `extension:fiscal-documentation`, y se copia en el mismo
 * `up()` si la tabla vieja existe.
 *
 * ────────────────────────────────────────────────────────────────────────────────
 * DOS índices únicos parciales por tabla, no uno.
 *
 * En Postgres `NULL != NULL` dentro de un índice único, así que un
 * `UNIQUE (site_id, namespace)` NO impide dos filas globales con el mismo namespace.
 * Con dos filas globales, resolver la config efectiva devolvería una de las dos al
 * azar — y el síntoma sería "a veces toma la configuración vieja".
 * ────────────────────────────────────────────────────────────────────────────────
 *
 * Idempotente en los dos sentidos. Sin FK a `demo_store`: ese módulo puede no estar
 * instalado en un proyecto de cliente y la FK haría fallar la migración entera.
 */
export class Migration20260807130000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "site_setting" (
        "id" TEXT NOT NULL,
        "site_id" TEXT NULL,
        "namespace" TEXT NOT NULL,
        "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "site_setting_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_setting_global_ns"
        ON "site_setting" ("namespace")
        WHERE "site_id" IS NULL AND "deleted_at" IS NULL;
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_setting_site_ns"
        ON "site_setting" ("site_id", "namespace")
        WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "site_setting_revision" (
        "id" TEXT NOT NULL,
        "site_id" TEXT NULL,
        "namespace" TEXT NOT NULL,
        "revision" INTEGER NOT NULL,
        "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "actor_id" TEXT NULL,
        "note" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "site_setting_revision_pkey" PRIMARY KEY ("id")
      );
    `);

    // Estos dos son los que arbitran las carreras de escritura: `upsertSiteSetting`
    // crea la revisión ANTES de tocar el valor, así que el perdedor falla sin escribir.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_setting_rev_global"
        ON "site_setting_revision" ("namespace", "revision")
        WHERE "site_id" IS NULL AND "deleted_at" IS NULL;
    `);
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_setting_rev_site"
        ON "site_setting_revision" ("site_id", "namespace", "revision")
        WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;
    `);
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_site_setting_rev_ns_created"
        ON "site_setting_revision" ("namespace", "created_at");
    `);

    /**
     * Copia de los namespaces que sobreviven desde la tabla vieja, si existe.
     *
     * Sólo `extension:*` y `template:*`: `project`, `branding` y `content` quedaron
     * superados por las columnas de `demo_store` y `extensions` era un toggle sin
     * lectores. Se copian como GLOBAL (`site_id NULL`), que es lo que eran.
     */
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_manager_setting') THEN
          INSERT INTO "site_setting" ("id", "site_id", "namespace", "value")
          SELECT 'sset_mig_' || md5("namespace"), NULL, "namespace", "value"
            FROM "site_manager_setting"
           WHERE "deleted_at" IS NULL
             AND ("namespace" LIKE 'extension:%' OR "namespace" LIKE 'template:%')
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_setting_rev_ns_created";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_setting_rev_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_setting_rev_global";`);
    this.addSql(`DROP TABLE IF EXISTS "site_setting_revision";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_setting_site_ns";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_setting_global_ns";`);
    this.addSql(`DROP TABLE IF EXISTS "site_setting";`);
  }
}
