import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Sistema tintométrico: data maestra propia (carta de colores, bases entonables
 * y el índice de fórmulas). Zeus cotiza el precio pero NO expone ninguna de las
 * tres cosas — los 51 endpoints de la API Ecommerce no tienen entidad
 * color/fórmula —, así que son tablas nuestras alimentadas por import.
 *
 * Los índices únicos van con `WHERE deleted_at IS NULL` para que el soft delete
 * de MedusaService no bloquee re-crear la misma fila.
 *
 * Idempotente: `IF NOT EXISTS` en todo, se puede correr sobre una base que ya la
 * tenga.
 */
export class Migration20260729190000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_tinting_color" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "collection" TEXT NOT NULL,
        "hex" TEXT NULL,
        "family" TEXT NULL,
        "group_key" TEXT NULL,
        "rank" INTEGER NOT NULL DEFAULT 0,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_tinting_color_collection_code_unique"
         ON "erp_tinting_color" ("collection", "code") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_tinting_color_collection_family"
         ON "erp_tinting_color" ("collection", "family") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_tinting_color_group_key"
         ON "erp_tinting_color" ("group_key") WHERE "deleted_at" IS NULL;`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_tinting_base" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "article_code" TEXT NOT NULL,
        "base_letter" TEXT NULL,
        "product_line" TEXT NOT NULL,
        "collection" TEXT NULL,
        "size_label" TEXT NULL,
        "size_liters" NUMERIC NULL,
        "title_snapshot" TEXT NULL,
        "source" TEXT NOT NULL DEFAULT 'parsed',
        "confirmed" BOOLEAN NOT NULL DEFAULT FALSE,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_tinting_base_article_code_unique"
         ON "erp_tinting_base" ("article_code") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_tinting_base_line_letter"
         ON "erp_tinting_base" ("product_line", "base_letter") WHERE "deleted_at" IS NULL;`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_tinting_formula" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "color_code" TEXT NOT NULL,
        "collection" TEXT NOT NULL,
        "product_line" TEXT NOT NULL,
        "base_letter" TEXT NULL,
        "zeus_formula_code" TEXT NOT NULL,
        "base_article_code" TEXT NULL,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL
      );
    `);
    // `base_letter` puede ser NULL (líneas con base única) y en Postgres los NULL
    // no chocan entre sí en un índice único, así que se normaliza con COALESCE
    // para que dos filas "sin letra" del mismo color/línea sí colisionen.
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_tinting_formula_key_unique"
         ON "erp_tinting_formula" ("color_code", "collection", "product_line", COALESCE("base_letter", ''))
         WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_tinting_formula_line_letter"
         ON "erp_tinting_formula" ("product_line", "base_letter") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_tinting_formula_base_article"
         ON "erp_tinting_formula" ("base_article_code") WHERE "deleted_at" IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "erp_tinting_formula";`);
    this.addSql(`DROP TABLE IF EXISTS "erp_tinting_base";`);
    this.addSql(`DROP TABLE IF EXISTS "erp_tinting_color";`);
  }
}
