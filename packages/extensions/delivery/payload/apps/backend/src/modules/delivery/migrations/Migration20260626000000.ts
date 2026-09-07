import { Migration } from '@mikro-orm/migrations';

/**
 * Vehículo multi-sucursal — reemplaza la columna escalar `store_location_id`
 * por `store_location_ids` (jsonb, array de ids). Un vehículo puede operar en
 * varias sucursales.
 *
 * up():
 *  1) agrega store_location_ids jsonb;
 *  2) backfill: el id único existente pasa a ser un array de un elemento;
 *  3) dropea el índice y la columna vieja.
 *
 * down(): reconstruye store_location_id tomando el PRIMER elemento del array
 * (mejor esfuerzo; la multi-sucursal no es representable en una sola columna).
 */
export class Migration20260626000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "store_location_ids" JSONB;`,
    );
    this.addSql(
      `UPDATE "vehicle" SET "store_location_ids" = jsonb_build_array("store_location_id") WHERE "store_location_id" IS NOT NULL AND "store_location_ids" IS NULL;`,
    );
    this.addSql(`DROP INDEX IF EXISTS "IDX_vehicle_store_location";`);
    this.addSql(`ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "store_location_id";`);
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "vehicle" ADD COLUMN IF NOT EXISTS "store_location_id" TEXT;`,
    );
    this.addSql(
      `UPDATE "vehicle" SET "store_location_id" = ("store_location_ids" ->> 0) WHERE "store_location_ids" IS NOT NULL AND jsonb_array_length("store_location_ids") > 0;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_store_location" ON "vehicle" ("store_location_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(`ALTER TABLE "vehicle" DROP COLUMN IF EXISTS "store_location_ids";`);
  }
}
