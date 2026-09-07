import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Analytics de compras recurrentes: tabla `recurring_metrics_daily` (snapshot
 * diario por sales channel; null = agregado global). Idempotente.
 */
export class Migration20260721150000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_metrics_daily" (
        "id"                    TEXT        NOT NULL,
        "date"                  TEXT        NOT NULL,
        "sales_channel_id"      TEXT,
        "active_count"          INTEGER     NOT NULL DEFAULT 0,
        "paused_count"          INTEGER     NOT NULL DEFAULT 0,
        "pending_payment_count" INTEGER     NOT NULL DEFAULT 0,
        "failed_count"          INTEGER     NOT NULL DEFAULT 0,
        "cancelled_count"       INTEGER     NOT NULL DEFAULT 0,
        "new_count"             INTEGER     NOT NULL DEFAULT 0,
        "cancelled_today"       INTEGER     NOT NULL DEFAULT 0,
        "renewals_success"      INTEGER     NOT NULL DEFAULT 0,
        "renewals_failed"       INTEGER     NOT NULL DEFAULT 0,
        "renewals_skipped"      INTEGER     NOT NULL DEFAULT 0,
        "pending_value"         NUMERIC     NOT NULL DEFAULT 0,
        "raw_pending_value"     JSONB,
        "mrr_estimate"          NUMERIC     NOT NULL DEFAULT 0,
        "raw_mrr_estimate"      JSONB,
        "currency_code"         TEXT,
        "top_products"          JSONB,
        "metadata"              JSONB,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "recurring_metrics_daily_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_metrics_daily_date_channel" ON "recurring_metrics_daily" ("date", "sales_channel_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_metrics_daily_date" ON "recurring_metrics_daily" ("date") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_metrics_daily_deleted_at" ON "recurring_metrics_daily" ("deleted_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "recurring_metrics_daily";`);
  }
}
