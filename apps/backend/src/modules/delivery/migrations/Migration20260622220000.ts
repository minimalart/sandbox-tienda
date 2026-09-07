import { Migration } from '@mikro-orm/migrations';

/**
 * Flota propia (paso 1) — tabla delivery_zone_resource (ZoneResource).
 *
 * Asignación N:M de recursos de flota propia (driver | vehicle) a una
 * DeliveryZone. `delivery_zone_id` y `resource_id` son FK lógicas al mismo
 * módulo (sin constraint cross-tabla). resource_type ∈ {'driver','vehicle'}.
 *
 * Unicidad entre filas vivas: (delivery_zone_id, resource_type, resource_id)
 * vía índice único parcial WHERE deleted_at IS NULL — un recurso no se asigna
 * dos veces a la misma zona.
 *
 * Reversible: down() borra solo esta tabla.
 */
export class Migration20260622220000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_zone_resource" (
        "id"               TEXT        NOT NULL,
        "delivery_zone_id" TEXT        NOT NULL,
        "resource_type"    TEXT        NOT NULL,
        "resource_id"      TEXT        NOT NULL,
        "active"           BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "delivery_zone_resource_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_resource_zone_type" ON "delivery_zone_resource" ("delivery_zone_id", "resource_type") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_resource_resource" ON "delivery_zone_resource" ("resource_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_delivery_zone_resource_assignment" ON "delivery_zone_resource" ("delivery_zone_id", "resource_type", "resource_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_resource_deleted_at" ON "delivery_zone_resource" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "delivery_zone_resource" CASCADE;`);
  }
}
