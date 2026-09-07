import { Migration } from '@mikro-orm/migrations';

/**
 * `app_setting` — valores de configuración por namespace, la tabla que permite
 * sacar variables del `.env` y editarlas desde el admin.
 *
 * El índice único es PARCIAL (`WHERE deleted_at IS NULL`) a propósito: los
 * borrados de Medusa son soft, así que sin el filtro, borrar un ajuste y volver
 * a configurarlo chocaría contra la fila vieja.
 *
 * Nombre con sufijo de módulo por la regla de `apps/backend/CLAUDE.md`:
 * `mikro_orm_migrations` es global y umzug registra por nombre de archivo sin
 * módulo, así que dos migraciones homónimas en módulos distintos hacen que la
 * segunda se saltee EN SILENCIO. Lo verifica `migration-names.test.ts`.
 */
export class Migration20260807120000AppSettings extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "app_setting" (
        "id"         TEXT         NOT NULL,
        "namespace"  TEXT         NOT NULL,
        "key"        TEXT         NOT NULL,
        "value"      JSONB,
        "ciphertext" TEXT,
        "is_secret"  BOOLEAN      NOT NULL DEFAULT FALSE,
        "updated_by" TEXT,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "app_setting_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_app_setting_namespace_key_unique" ON "app_setting" ("namespace", "key") WHERE deleted_at IS NULL;`,
    );
    // El acceso siempre es por namespace completo (una query por card), nunca
    // por key suelta.
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_app_setting_namespace" ON "app_setting" ("namespace") WHERE deleted_at IS NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "app_setting";`);
  }
}
