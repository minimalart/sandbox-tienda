import { Migration } from '@mikro-orm/migrations';

export class Migration20260622120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_execution" (
        "id"                   TEXT        NOT NULL,
        "provider_type"        TEXT        NOT NULL,
        "service_mode"         TEXT        NOT NULL,
        "status"               TEXT        NOT NULL DEFAULT 'pending',
        "external_shipment_id" TEXT,
        "tracking_number"      TEXT,
        "label_url"            TEXT,
        "assigned_at"          TIMESTAMPTZ,
        "dispatched_at"        TIMESTAMPTZ,
        "delivered_at"         TIMESTAMPTZ,
        "failed_at"            TIMESTAMPTZ,
        "attempt_count"        INTEGER     NOT NULL DEFAULT 0,
        "scheduled_window"     JSONB,
        "delivery_zone_id"     TEXT,
        "last_event_at"        TIMESTAMPTZ,
        "metadata"             JSONB,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"           TIMESTAMPTZ,
        CONSTRAINT "delivery_execution_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_status" ON "delivery_execution" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_provider_type" ON "delivery_execution" ("provider_type") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_external_shipment" ON "delivery_execution" ("external_shipment_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_deleted_at" ON "delivery_execution" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "delivery_execution";`);
  }
}
