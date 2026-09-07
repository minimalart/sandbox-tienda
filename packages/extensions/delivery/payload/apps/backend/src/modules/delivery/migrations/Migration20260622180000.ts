import { Migration } from '@mikro-orm/migrations';

/**
 * M10 — Logistics Cloud multi-tienda: store_location_id directo en
 * delivery_execution.
 *
 * Hasta M9 la tienda de una ejecución se INFERÍA por su zona
 * (delivery_zone.store_location_id) o por la sucursal de origen. M10 agrega la
 * columna directa para hacer el scoping end-to-end consistente y filtrable sin
 * traducir a zonas.
 *
 * - store_location_id: TEXT nullable (FK lógica a store_location.id, sin
 *   constraint cross-tabla, mismo patrón que driver_id / delivery_zone_id).
 *   Nullable porque no toda ejecución tiene tienda (ej. Andreani nacional).
 * - Index parcial (deleted_at IS NULL) para los filtros del board/analytics.
 *
 * Reversible: down() borra la columna (el index cae con ella).
 *
 * BACKFILL (opcional, NO ejecutado acá): las ejecuciones previas quedan con
 * store_location_id = NULL. Si se quiere resolverlas por su zona, ver
 * src/scripts/backfill-execution-store-location.ts.
 */
export class Migration20260622180000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "delivery_execution" ADD COLUMN IF NOT EXISTS "store_location_id" TEXT NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_store_location" ON "delivery_execution" ("store_location_id") WHERE "deleted_at" IS NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_delivery_execution_store_location";`,
    );
    this.addSql(
      `ALTER TABLE "delivery_execution" DROP COLUMN IF EXISTS "store_location_id";`,
    );
  }
}
