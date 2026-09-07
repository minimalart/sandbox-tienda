import { Migration } from '@mikro-orm/migrations';

/**
 * Flota propia (paso 1) — capacidad de frío y topes operativos.
 *
 * Vehicle:
 *  - has_refrigeration: BOOLEAN NOT NULL DEFAULT FALSE. El vehículo puede
 *    transportar carga refrigerada/congelada.
 *  - max_orders: INTEGER NULL. Tope de órdenes por viaje (null = sin tope).
 *  - temperature_modes: JSONB NULL. Array de TemperatureMode soportados.
 *  + índice parcial sobre has_refrigeration (WHERE deleted_at IS NULL).
 *
 * Driver:
 *  - max_active_deliveries: INTEGER NULL. Tope de entregas activas simultáneas
 *    (null = sin tope). La carga ACTUAL no se persiste: se calcula on-the-fly.
 *
 * Tablas reales confirmadas: 'vehicle' y 'driver' (model.define('vehicle' / 'driver')).
 *
 * Reversible: down() borra columnas e índice.
 */
export class Migration20260622200000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "has_refrigeration" BOOLEAN NOT NULL DEFAULT FALSE;`,
    );
    this.addSql(
      `ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "max_orders" INTEGER NULL;`,
    );
    this.addSql(
      `ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "temperature_modes" JSONB NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_has_refrigeration" ON "vehicle" ("has_refrigeration") WHERE "deleted_at" IS NULL;`,
    );

    this.addSql(
      `ALTER TABLE "driver" ADD COLUMN IF NOT EXISTS "max_active_deliveries" INTEGER NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_vehicle_has_refrigeration";`);
    this.addSql(
      `ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "temperature_modes";`,
    );
    this.addSql(`ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "max_orders";`);
    this.addSql(
      `ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "has_refrigeration";`,
    );

    this.addSql(
      `ALTER TABLE "driver" DROP COLUMN IF EXISTS "max_active_deliveries";`,
    );
  }
}
