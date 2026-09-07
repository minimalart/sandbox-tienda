import { Migration } from '@mikro-orm/migrations';

/**
 * M3 — flota propia (own_fleet): tablas driver + vehicle y columnas de
 * asignación en delivery_execution (driver_id / vehicle_id / route_id).
 *
 * Reversible: down() borra las tablas nuevas y las columnas agregadas. NO toca
 * nada de Andreani ni de M1/M2/M4.
 */
export class Migration20260622140000 extends Migration {
  async up(): Promise<void> {
    // --- driver ---
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "driver" (
        "id"                TEXT        NOT NULL,
        "name"              TEXT        NOT NULL,
        "phone"             TEXT,
        "email"             TEXT,
        "status"            TEXT        NOT NULL DEFAULT 'offline',
        "store_location_id" TEXT,
        "user_id"           TEXT,
        "active"            BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "driver_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_status" ON "driver" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_store_location" ON "driver" ("store_location_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_user" ON "driver" ("user_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_driver_deleted_at" ON "driver" ("deleted_at");`,
    );

    // --- vehicle ---
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "vehicle" (
        "id"                TEXT        NOT NULL,
        "plate"             TEXT        NOT NULL,
        "type"              TEXT        NOT NULL,
        "capacity_kg"       INTEGER,
        "capacity_m3"       INTEGER,
        "store_location_id" TEXT,
        "driver_id"         TEXT,
        "active"            BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_store_location" ON "vehicle" ("store_location_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_active" ON "vehicle" ("active") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_deleted_at" ON "vehicle" ("deleted_at");`,
    );

    // --- delivery_execution: columnas de asignación ---
    this.addSql(
      `ALTER TABLE "delivery_execution" ADD COLUMN IF NOT EXISTS "driver_id" TEXT;`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" ADD COLUMN IF NOT EXISTS "vehicle_id" TEXT;`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" ADD COLUMN IF NOT EXISTS "route_id" TEXT;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_driver" ON "delivery_execution" ("driver_id") WHERE "deleted_at" IS NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_delivery_execution_driver";`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" DROP COLUMN IF EXISTS "route_id";`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" DROP COLUMN IF EXISTS "vehicle_id";`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" DROP COLUMN IF EXISTS "driver_id";`,
    );
    this.addSql(`DROP TABLE IF EXISTS "vehicle";`);
    this.addSql(`DROP TABLE IF EXISTS "driver";`);
  }
}
