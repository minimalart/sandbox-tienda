import { Migration } from '@mikro-orm/migrations';

/**
 * Flota propia (paso 1) — tabla driver_shift.
 *
 * Franjas horarias de disponibilidad de un repartidor por día de la semana.
 * `driver_id` es FK lógica al Driver del mismo módulo (sin constraint cross-tabla,
 * igual patrón que el resto del módulo). day_of_week 0..6 (0=domingo, JS
 * Date.getDay()); start_time/end_time en 'HH:mm' local.
 *
 * Reversible: down() borra solo esta tabla.
 */
export class Migration20260622210000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "driver_shift" (
        "id"          TEXT        NOT NULL,
        "driver_id"   TEXT        NOT NULL,
        "day_of_week" INTEGER     NOT NULL,
        "start_time"  TEXT        NOT NULL,
        "end_time"    TEXT        NOT NULL,
        "active"      BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"    JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "driver_shift_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_shift_driver_day" ON "driver_shift" ("driver_id", "day_of_week") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_shift_active" ON "driver_shift" ("active") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_shift_deleted_at" ON "driver_shift" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "driver_shift" CASCADE;`);
  }
}
