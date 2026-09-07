import { Migration } from '@mikro-orm/migrations';

/**
 * M7 — Route Planner: tablas delivery_route y delivery_route_stop.
 *
 * - delivery_route: agrupa ejecuciones de FLOTA PROPIA en una ruta asignada a un
 *   driver/vehicle. driver_id/vehicle_id/store_location_id son FK lógicas (sin
 *   constraint cross-tabla, mismo patrón que delivery_execution.driver_id).
 * - delivery_route_stop: parada ordenada (sequence) que apunta a una
 *   DeliveryExecution. lat/lng son snapshot de la dirección de la orden.
 *
 * NO toca delivery_execution: la columna route_id ya existe desde M3. Reversible:
 * down() borra solo estas dos tablas.
 */
export class Migration20260622170000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_route" (
        "id"                 TEXT        NOT NULL,
        "code"               TEXT        NOT NULL,
        "driver_id"          TEXT,
        "vehicle_id"         TEXT,
        "store_location_id"  TEXT,
        "status"             TEXT        NOT NULL DEFAULT 'planned',
        "planned_date"       TIMESTAMPTZ,
        "started_at"         TIMESTAMPTZ,
        "completed_at"       TIMESTAMPTZ,
        "optimization_meta"  JSONB,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "delivery_route_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_status" ON "delivery_route" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_driver" ON "delivery_route" ("driver_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_planned_date" ON "delivery_route" ("planned_date") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_deleted_at" ON "delivery_route" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_route_stop" (
        "id"                    TEXT             NOT NULL,
        "route_id"              TEXT             NOT NULL,
        "delivery_execution_id" TEXT             NOT NULL,
        "sequence"              INTEGER          NOT NULL,
        "status"                TEXT             NOT NULL DEFAULT 'pending',
        "eta"                   TIMESTAMPTZ,
        "arrived_at"            TIMESTAMPTZ,
        "completed_at"          TIMESTAMPTZ,
        "lat"                   DOUBLE PRECISION,
        "lng"                   DOUBLE PRECISION,
        "metadata"              JSONB,
        "created_at"            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "delivery_route_stop_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_stop_route_sequence" ON "delivery_route_stop" ("route_id", "sequence") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_stop_execution" ON "delivery_route_stop" ("delivery_execution_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_route_stop_deleted_at" ON "delivery_route_stop" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "delivery_route_stop" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "delivery_route" CASCADE;`);
  }
}
