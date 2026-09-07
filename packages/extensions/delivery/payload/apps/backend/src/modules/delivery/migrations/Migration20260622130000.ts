import { Migration } from '@mikro-orm/migrations';

export class Migration20260622130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "tracking_event" (
        "id"                    TEXT        NOT NULL,
        "delivery_execution_id" TEXT        NOT NULL,
        "source"                TEXT        NOT NULL,
        "code"                  TEXT        NOT NULL,
        "external_code"         TEXT,
        "description"           TEXT,
        "occurred_at"           TIMESTAMPTZ NOT NULL,
        "location"              JSONB,
        "raw"                   JSONB,
        "metadata"              JSONB,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "tracking_event_pkey" PRIMARY KEY ("id")
      );
    `);

    // Orden natural del timeline por ejecución.
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracking_event_execution_occurred" ON "tracking_event" ("delivery_execution_id", "occurred_at") WHERE "deleted_at" IS NULL;`,
    );

    // DEDUPE / idempotencia de ingesta: un mismo (execution, external_code,
    // occurred_at) no puede insertarse dos veces. Parcial sobre deleted_at IS
    // NULL para no chocar con soft-deletes. external_code NULL no colisiona
    // (dos NULL son distintos en Postgres), a propósito.
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tracking_event_dedupe" ON "tracking_event" ("delivery_execution_id", "external_code", "occurred_at") WHERE "deleted_at" IS NULL;`,
    );

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tracking_event_deleted_at" ON "tracking_event" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "tracking_event";`);
  }
}
