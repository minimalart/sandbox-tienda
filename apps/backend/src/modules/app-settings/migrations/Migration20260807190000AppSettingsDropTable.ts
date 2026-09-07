import { Migration } from '@mikro-orm/migrations';

/**
 * Da de baja `app_setting`: la configuración pasó a vivir en `site_setting`.
 *
 * ## Por qué una migración NUEVA y no borrar `Migration20260807120000AppSettings.ts`
 *
 * Porque borrar el archivo no borra nada de la base. `mikro_orm_migrations`
 * registra por NOMBRE, y umzug sólo mira lo que está PENDIENTE: sacando el
 * archivo, la fila `Migration20260807120000AppSettings` queda huérfana —apuntando
 * a una migración que ya no existe— y la tabla `app_setting` queda viva y sin
 * dueño en toda base donde esa migración ya corrió (cualquier dev que haya hecho
 * `pnpm db:migrate` en esta rama). Una tabla sin modelo, sin migración y sin
 * lector es exactamente el tipo de resto que dentro de seis meses nadie se anima
 * a tocar porque no sabe si algo la usa.
 *
 * Es además la regla dura de `apps/backend/CLAUDE.md`: nunca editar ni borrar una
 * migración aplicada; se escribe una NUEVA idempotente. La de creación queda tal
 * cual —crea la tabla, esta la baja— y una base virgen termina en el mismo estado
 * que una que pasó por las dos.
 *
 * ## Por qué no hay backfill
 *
 * Porque no hay nada que backfillear. `app_setting` nació en ESTA rama, nunca
 * llegó a `main` ni a producción, y las únicas filas posibles son las que un dev
 * cargó probando la card. Escribir un `INSERT … SELECT` de `app_setting` a
 * `site_setting` sería mover a la fila GLOBAL valores que se cargaron sin ninguna
 * noción de tienda, y en un entorno multitienda eso no es "conservar datos": es
 * publicarle a todas las tiendas la config de prueba de alguien. Si a alguien le
 * importa lo que tenía cargado, lo recarga desde la card en treinta segundos.
 *
 * ## Idempotencia
 *
 * `DROP TABLE IF EXISTS` cubre los tres estados posibles: base virgen (la tabla
 * nunca existió), base de dev con la migración de creación aplicada, y base que
 * ya corrió ésta. Los índices caen con la tabla, no hace falta nombrarlos.
 *
 * Nombre con sufijo de módulo por la regla de `apps/backend/CLAUDE.md`, que hace
 * cumplir `migration-names.test.ts`.
 */
export class Migration20260807190000AppSettingsDropTable extends Migration {
  async up(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "app_setting";`);
  }

  /**
   * El `down` recrea la tabla VACÍA, no restaura datos: el drop es destructivo y
   * fingir lo contrario sería peor. Existe para que un `db:rollback` deje el
   * esquema tal como lo dejaba la migración de creación, y no a medio camino.
   */
  async down(): Promise<void> {
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
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_app_setting_namespace" ON "app_setting" ("namespace") WHERE deleted_at IS NULL;`,
    );
  }
}
