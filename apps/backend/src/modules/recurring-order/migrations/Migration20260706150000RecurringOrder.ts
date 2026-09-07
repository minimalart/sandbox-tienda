import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Tablas del módulo de compras recurrentes: `recurring_order` (suscripción) +
 * `recurring_order_item` + `renewal_cycle` (ejecuciones programadas) +
 * `renewal_attempt` (historial de corridas). Idempotente (IF NOT EXISTS /
 * duplicate_object) según la convención del repo.
 */
export class Migration20260706150000RecurringOrder extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_order" (
        "id"                   TEXT        NOT NULL,
        "customer_id"          TEXT        NOT NULL,
        "email"                TEXT,
        "phone"                TEXT,
        "sales_channel_id"     TEXT        NOT NULL,
        "region_id"            TEXT,
        "country_code"         TEXT,
        "currency_code"        TEXT,
        "status"               TEXT        NOT NULL DEFAULT 'active',
        "payment_mode"         TEXT        NOT NULL DEFAULT 'manual_link',
        "payment_context"      JSONB,
        "frequency_interval"   TEXT        NOT NULL,
        "frequency_count"      INTEGER     NOT NULL DEFAULT 1,
        "next_execution_at"    TIMESTAMPTZ,
        "last_execution_at"    TIMESTAMPTZ,
        "paused_at"            TIMESTAMPTZ,
        "cancelled_at"         TIMESTAMPTZ,
        "skip_next_cycle"      BOOLEAN     NOT NULL DEFAULT FALSE,
        "consecutive_failures" INTEGER     NOT NULL DEFAULT 0,
        "shipping_address"     JSONB       NOT NULL,
        "billing_address"      JSONB,
        "shipping_option_id"   TEXT,
        "metadata"             JSONB,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"           TIMESTAMPTZ,
        CONSTRAINT "recurring_order_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_customer_id" ON "recurring_order" ("customer_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_status" ON "recurring_order" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_sales_channel_id" ON "recurring_order" ("sales_channel_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_next_execution_at" ON "recurring_order" ("next_execution_at") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_deleted_at" ON "recurring_order" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "recurring_order_item" (
        "id"                 TEXT        NOT NULL,
        "recurring_order_id" TEXT        NOT NULL,
        "product_id"         TEXT        NOT NULL,
        "variant_id"         TEXT        NOT NULL,
        "quantity"           INTEGER     NOT NULL,
        "product_snapshot"   JSONB,
        "pricing_snapshot"   JSONB,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "recurring_order_item_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_item_recurring_order_id" ON "recurring_order_item" ("recurring_order_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_item_variant_id" ON "recurring_order_item" ("variant_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_recurring_order_item_deleted_at" ON "recurring_order_item" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "renewal_cycle" (
        "id"                 TEXT        NOT NULL,
        "recurring_order_id" TEXT        NOT NULL,
        "scheduled_at"       TIMESTAMPTZ NOT NULL,
        "processed_at"       TIMESTAMPTZ,
        "status"             TEXT        NOT NULL DEFAULT 'scheduled',
        "cart_id"            TEXT,
        "generated_order_id" TEXT,
        "payment_status"     TEXT,
        "payment_reference"  TEXT,
        "confirmation_url"   TEXT,
        "expires_at"         TIMESTAMPTZ,
        "reminder_sent_at"   TIMESTAMPTZ,
        "attempt_count"      INTEGER     NOT NULL DEFAULT 0,
        "last_error"         TEXT,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "renewal_cycle_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_cycle_recurring_order_id" ON "renewal_cycle" ("recurring_order_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_cycle_status_scheduled_at" ON "renewal_cycle" ("status", "scheduled_at") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_cycle_cart_id" ON "renewal_cycle" ("cart_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_cycle_deleted_at" ON "renewal_cycle" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "renewal_attempt" (
        "id"               TEXT        NOT NULL,
        "renewal_cycle_id" TEXT        NOT NULL,
        "started_at"       TIMESTAMPTZ NOT NULL,
        "finished_at"      TIMESTAMPTZ,
        "result"           TEXT        NOT NULL DEFAULT 'running',
        "error"            TEXT,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "renewal_attempt_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_attempt_renewal_cycle_id" ON "renewal_attempt" ("renewal_cycle_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_renewal_attempt_deleted_at" ON "renewal_attempt" ("deleted_at");`,
    );

    // FKs con nombre estable, idempotentes (duplicate_object) según convención.
    this.addSql(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_order_item_recurring_order_id_foreign') THEN
          ALTER TABLE "recurring_order_item"
            ADD CONSTRAINT "recurring_order_item_recurring_order_id_foreign"
            FOREIGN KEY ("recurring_order_id") REFERENCES "recurring_order" ("id")
            ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'renewal_cycle_recurring_order_id_foreign') THEN
          ALTER TABLE "renewal_cycle"
            ADD CONSTRAINT "renewal_cycle_recurring_order_id_foreign"
            FOREIGN KEY ("recurring_order_id") REFERENCES "recurring_order" ("id")
            ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    this.addSql(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'renewal_attempt_renewal_cycle_id_foreign') THEN
          ALTER TABLE "renewal_attempt"
            ADD CONSTRAINT "renewal_attempt_renewal_cycle_id_foreign"
            FOREIGN KEY ("renewal_cycle_id") REFERENCES "renewal_cycle" ("id")
            ON UPDATE CASCADE ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "renewal_attempt";`);
    this.addSql(`DROP TABLE IF EXISTS "renewal_cycle";`);
    this.addSql(`DROP TABLE IF EXISTS "recurring_order_item";`);
    this.addSql(`DROP TABLE IF EXISTS "recurring_order";`);
  }
}
