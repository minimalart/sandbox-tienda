import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/** Suscripciones V2: planes, contrato financiero, alertas y outbox. */
export class Migration20260904123000RecurringOrderV2 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_plan" (
      "id" TEXT NOT NULL, "sales_channel_id" TEXT, "name" TEXT NOT NULL,
      "handle" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
      "version" INTEGER NOT NULL DEFAULT 1,
      "purchase_mode" TEXT NOT NULL DEFAULT 'one_time_and_subscription',
      "price_policy" TEXT NOT NULL DEFAULT 'dynamic',
      "promotion_policy" TEXT NOT NULL DEFAULT 'best_benefit',
      "allow_stacking" BOOLEAN NOT NULL DEFAULT FALSE, "currency_code" TEXT,
      "preflight_hours" INTEGER NOT NULL DEFAULT 72,
      "reservation_hours" INTEGER NOT NULL DEFAULT 24,
      "stock_retry_hours" INTEGER NOT NULL DEFAULT 72,
      "stock_retry_interval_hours" INTEGER NOT NULL DEFAULT 6,
      "payment_retry_hours" INTEGER NOT NULL DEFAULT 72,
      "payment_retry_interval_hours" INTEGER NOT NULL DEFAULT 6,
      "forecast_windows" JSONB, "trial_days" INTEGER NOT NULL DEFAULT 0,
      "minimum_cycles" INTEGER NOT NULL DEFAULT 0,
      "cancellation_policy" TEXT NOT NULL DEFAULT 'immediate',
      "legacy" BOOLEAN NOT NULL DEFAULT FALSE, "published_at" TIMESTAMPTZ,
      "archived_at" TIMESTAMPTZ, "metadata" JSONB,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_plan_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_plan_channel_status" ON "subscription_plan" ("sales_channel_id", "status") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_plan_handle_version" ON "subscription_plan" (COALESCE("sales_channel_id", ''), "handle", "version") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_plan_offer" (
      "id" TEXT NOT NULL, "plan_id" TEXT NOT NULL, "label" TEXT,
      "frequency_interval" TEXT NOT NULL, "frequency_count" INTEGER NOT NULL DEFAULT 1,
      "discount_type" TEXT NOT NULL DEFAULT 'none', "discount_value" NUMERIC NOT NULL DEFAULT 0,
      "currency_code" TEXT, "fixed_unit_prices" JSONB,
      "sort_order" INTEGER NOT NULL DEFAULT 0, "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "metadata" JSONB, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_plan_offer_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_plan_offer_plan" ON "subscription_plan_offer" ("plan_id", "enabled") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_plan_offer_frequency" ON "subscription_plan_offer" ("plan_id", "frequency_interval", "frequency_count") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_target" (
      "id" TEXT NOT NULL, "plan_id" TEXT NOT NULL, "target_type" TEXT NOT NULL,
      "target_id" TEXT NOT NULL, "precedence" INTEGER NOT NULL DEFAULT 0,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE, "metadata" JSONB,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_target_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_target_plan" ON "subscription_target" ("plan_id") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_target_lookup" ON "subscription_target" ("target_type", "target_id") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_target_unique" ON "subscription_target" ("plan_id", "target_type", "target_id") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_alert" (
      "id" TEXT NOT NULL, "sales_channel_id" TEXT, "recurring_order_id" TEXT,
      "renewal_cycle_id" TEXT, "variant_id" TEXT, "type" TEXT NOT NULL,
      "severity" TEXT NOT NULL DEFAULT 'warning', "status" TEXT NOT NULL DEFAULT 'open',
      "dedupe_key" TEXT NOT NULL, "title" TEXT NOT NULL, "message" TEXT,
      "data" JSONB, "detected_at" TIMESTAMPTZ NOT NULL, "notified_at" TIMESTAMPTZ,
      "resolved_at" TIMESTAMPTZ, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_alert_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_alert_dedupe" ON "subscription_alert" ("dedupe_key") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_alert_status" ON "subscription_alert" ("status", "type") WHERE "deleted_at" IS NULL;`);

    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_cancellation_reason" (
      "id" TEXT NOT NULL, "sales_channel_id" TEXT, "code" TEXT NOT NULL,
      "label" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "sort_order" INTEGER NOT NULL DEFAULT 0, "metadata" JSONB,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_cancellation_reason_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_reason_code" ON "subscription_cancellation_reason" (COALESCE("sales_channel_id", ''), "code") WHERE "deleted_at" IS NULL;`);
    this.addSql(`INSERT INTO "subscription_cancellation_reason"
      ("id", "sales_channel_id", "code", "label", "enabled", "sort_order") VALUES
      ('screason_price', NULL, 'precio', 'El precio ya no me conviene', TRUE, 10),
      ('screason_need', NULL, 'no_lo_necesito', 'Ya no lo necesito', TRUE, 20),
      ('screason_delivery', NULL, 'problemas_entrega', 'Tuve problemas con las entregas', TRUE, 30),
      ('screason_other', NULL, 'otro', 'Otro motivo', TRUE, 100)
      ON CONFLICT DO NOTHING;`);

    this.addSql(`CREATE TABLE IF NOT EXISTS "subscription_notification" (
      "id" TEXT NOT NULL, "recurring_order_id" TEXT, "renewal_cycle_id" TEXT,
      "sales_channel_id" TEXT, "dedupe_key" TEXT NOT NULL, "channel" TEXT NOT NULL,
      "recipient" TEXT NOT NULL, "template" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending', "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "data" JSONB, "next_attempt_at" TIMESTAMPTZ, "sent_at" TIMESTAMPTZ,
      "last_error" TEXT, "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "deleted_at" TIMESTAMPTZ,
      CONSTRAINT "subscription_notification_pkey" PRIMARY KEY ("id")
    );`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_subscription_notification_dedupe" ON "subscription_notification" ("dedupe_key") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_subscription_notification_due" ON "subscription_notification" ("status", "next_attempt_at") WHERE "deleted_at" IS NULL;`);

    for (const column of [
      '"plan_id" TEXT', '"plan_version" INTEGER', '"offer_id" TEXT',
      '"plan_snapshot" JSONB', '"payment_provider" TEXT NOT NULL DEFAULT \'manual\'',
      '"external_subscription_id" TEXT', '"financial_status" TEXT NOT NULL DEFAULT \'manual\'',
      '"next_billing_at" TIMESTAMPTZ', '"cycles_completed" INTEGER NOT NULL DEFAULT 0',
      '"terms_accepted_at" TIMESTAMPTZ', '"terms_version" TEXT', '"provider_state" JSONB',
    ]) this.addSql(`ALTER TABLE IF EXISTS "recurring_order" ADD COLUMN IF NOT EXISTS ${column};`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_recurring_order_plan" ON "recurring_order" ("plan_id") WHERE "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recurring_order_external_subscription" ON "recurring_order" ("payment_provider", "external_subscription_id") WHERE "external_subscription_id" IS NOT NULL AND "deleted_at" IS NULL;`);

    for (const column of [
      '"provider_payment_id" TEXT', '"idempotency_key" TEXT', '"expected_amount" NUMERIC',
      '"charged_amount" NUMERIC', '"quote_snapshot" JSONB', '"quote_hash" TEXT',
      '"inventory_reservation_ids" JSONB', '"forecasted_at" TIMESTAMPTZ',
        '"quoted_at" TIMESTAMPTZ', '"reserved_at" TIMESTAMPTZ', '"paid_at" TIMESTAMPTZ',
        '"refunded_at" TIMESTAMPTZ', '"order_created_at" TIMESTAMPTZ', '"retry_until" TIMESTAMPTZ',
    ]) this.addSql(`ALTER TABLE IF EXISTS "renewal_cycle" ADD COLUMN IF NOT EXISTS ${column};`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_renewal_cycle_idempotency" ON "renewal_cycle" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL AND "deleted_at" IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_renewal_cycle_provider_payment" ON "renewal_cycle" ("provider_payment_id") WHERE "provider_payment_id" IS NOT NULL AND "deleted_at" IS NULL;`);

    for (const column of [
      '"source" TEXT NOT NULL DEFAULT \'internal\'', '"correlation_id" TEXT',
      '"before_state" JSONB', '"after_state" JSONB', '"external_reference" TEXT',
    ]) this.addSql(`ALTER TABLE IF EXISTS "recurring_log" ADD COLUMN IF NOT EXISTS ${column};`);
  }

  override async down(): Promise<void> {
    // Intencionalmente no destructivo. El rollback operativo se hace apagando
    // flags, pausando preapprovals y volviendo a manual_link; planes, ciclos,
    // outbox y auditoría se conservan para conciliación.
  }
}
