import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Cancelación con retención + activity log: tablas `recurring_log` y
 * `cancellation_case`, y columna `retention_discount` en `recurring_setting`
 * ({percentage, cycles} — la oferta "quedate y llevá X% en tus próximas N
 * entregas"). Idempotente.
 */
export class Migration20260721170000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_log" (
        "id"                 TEXT        NOT NULL,
        "recurring_order_id" TEXT        NOT NULL,
        "event"              TEXT        NOT NULL,
        "actor_type"         TEXT        NOT NULL DEFAULT 'system',
        "actor_id"           TEXT,
        "data"               JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "recurring_log_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_log_recurring_order_id" ON "recurring_log" ("recurring_order_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_log_event" ON "recurring_log" ("event") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_log_deleted_at" ON "recurring_log" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "cancellation_case" (
        "id"                 TEXT        NOT NULL,
        "recurring_order_id" TEXT        NOT NULL,
        "status"             TEXT        NOT NULL DEFAULT 'requested',
        "reason"             TEXT,
        "reason_note"        TEXT,
        "retention_offer"    JSONB,
        "decided_at"         TIMESTAMPTZ,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "cancellation_case_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cancellation_case_recurring_order_id" ON "cancellation_case" ("recurring_order_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cancellation_case_status" ON "cancellation_case" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cancellation_case_reason" ON "cancellation_case" ("reason") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_cancellation_case_deleted_at" ON "cancellation_case" ("deleted_at");`,
    );

    this.addSql(
      `ALTER TABLE IF EXISTS "recurring_setting" ADD COLUMN IF NOT EXISTS "retention_discount" JSONB;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "recurring_log";`);
    this.addSql(`DROP TABLE IF EXISTS "cancellation_case";`);
    this.addSql(
      `ALTER TABLE IF EXISTS "recurring_setting" DROP COLUMN IF EXISTS "retention_discount";`,
    );
  }
}
