"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260719160000GiftCardExperience = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
class Migration20260719160000GiftCardExperience extends migrations_1.Migration {
    async up() {
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_design" (
        "id" TEXT NOT NULL,
        "public_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "occasion" TEXT NOT NULL DEFAULT 'general',
        "desktop_image_url" TEXT NOT NULL,
        "mobile_image_url" TEXT,
        "text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
        "content_position" TEXT NOT NULL DEFAULT 'center',
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "gift_card_design_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_design_public_id" ON "gift_card_design" ("public_id") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_design_active_order" ON "gift_card_design" ("active", "sort_order");`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_settings" (
        "id" TEXT NOT NULL,
        "singleton_key" TEXT NOT NULL DEFAULT 'default',
        "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
        "morning_time" TEXT NOT NULL DEFAULT '09:00',
        "afternoon_time" TEXT NOT NULL DEFAULT '14:00',
        "evening_time" TEXT NOT NULL DEFAULT '19:00',
        "schedule_horizon_days" INTEGER NOT NULL DEFAULT 365,
        "default_expiry_days" INTEGER,
        "default_design_id" TEXT NOT NULL DEFAULT 'brand-default',
        "max_name_length" INTEGER NOT NULL DEFAULT 80,
        "max_message_length" INTEGER NOT NULL DEFAULT 300,
        "retry_delays_minutes" JSONB NOT NULL DEFAULT '{"delays":[1,5,30,120,720]}'::jsonb,
        "fallback_to_buyer" BOOLEAN NOT NULL DEFAULT TRUE,
        "legal_text" TEXT,
        "terms_url" TEXT,
        "merchandising_url" TEXT,
        "updated_by" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "gift_card_settings_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_settings_singleton" ON "gift_card_settings" ("singleton_key") WHERE "deleted_at" IS NULL;`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_delivery" (
        "id" TEXT NOT NULL,
        "idempotency_key" TEXT NOT NULL,
        "order_id" TEXT NOT NULL,
        "order_display_id" INTEGER,
        "line_item_id" TEXT NOT NULL,
        "unit_index" INTEGER NOT NULL DEFAULT 0,
        "gift_card_id" TEXT,
        "store_credit_account_id" TEXT,
        "buyer_customer_id" TEXT,
        "buyer_email" TEXT NOT NULL,
        "delivery_mode" TEXT NOT NULL,
        "recipient_email" TEXT,
        "recipient_name" TEXT,
        "sender_name" TEXT,
        "anonymous" BOOLEAN NOT NULL DEFAULT FALSE,
        "message" TEXT,
        "design_id" TEXT NOT NULL,
        "design_snapshot" JSONB NOT NULL,
        "currency_code" TEXT NOT NULL,
        "face_value" NUMERIC NOT NULL,
        "paid_amount" NUMERIC NOT NULL,
        "timezone" TEXT NOT NULL,
        "scheduled_at" TIMESTAMPTZ,
        "expires_at" TIMESTAMPTZ,
        "token_hash" TEXT,
        "token_encrypted" TEXT,
        "token_version" INTEGER NOT NULL DEFAULT 1,
        "issuance_status" TEXT NOT NULL DEFAULT 'awaiting_payment',
        "delivery_status" TEXT NOT NULL DEFAULT 'not_ready',
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "next_retry_at" TIMESTAMPTZ,
        "processing_started_at" TIMESTAMPTZ,
        "paid_at" TIMESTAMPTZ,
        "issued_at" TIMESTAMPTZ,
        "sent_at" TIMESTAMPTZ,
        "delivered_at" TIMESTAMPTZ,
        "failed_at" TIMESTAMPTZ,
        "claimed_at" TIMESTAMPTZ,
        "claimed_customer_id" TEXT,
        "first_used_at" TIMESTAMPTZ,
        "exhausted_at" TIMESTAMPTZ,
        "provider_message_id" TEXT,
        "last_error" TEXT,
        "fallback_sent_at" TIMESTAMPTZ,
        "legacy" BOOLEAN NOT NULL DEFAULT FALSE,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "gift_card_delivery_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_delivery_idempotency" ON "gift_card_delivery" ("idempotency_key") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_delivery_token" ON "gift_card_delivery" ("token_hash") WHERE "deleted_at" IS NULL AND "token_hash" IS NOT NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_delivery_order_item" ON "gift_card_delivery" ("order_id", "line_item_id", "unit_index");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_delivery_gift_card" ON "gift_card_delivery" ("gift_card_id");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_delivery_outbox" ON "gift_card_delivery" ("delivery_status", "next_retry_at");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_delivery_issuance" ON "gift_card_delivery" ("issuance_status", "processing_started_at");`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_delivery_attempt" (
        "id" TEXT NOT NULL,
        "delivery_id" TEXT NOT NULL,
        "attempt_no" INTEGER NOT NULL,
        "channel" TEXT NOT NULL DEFAULT 'email',
        "trigger" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "recipient" TEXT NOT NULL,
        "notification_id" TEXT,
        "provider_message_id" TEXT,
        "error" TEXT,
        "attempted_at" TIMESTAMPTZ NOT NULL,
        "completed_at" TIMESTAMPTZ,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "gift_card_delivery_attempt_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "gift_card_delivery_attempt_delivery_fk" FOREIGN KEY ("delivery_id") REFERENCES "gift_card_delivery" ("id") ON DELETE CASCADE
      );
    `);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_attempt_number" ON "gift_card_delivery_attempt" ("delivery_id", "attempt_no") WHERE "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_attempt_provider" ON "gift_card_delivery_attempt" ("provider_message_id");`);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_webhook_event" (
        "event_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "event_type" TEXT NOT NULL,
        "message_id" TEXT NOT NULL,
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "gift_card_webhook_event_pkey" PRIMARY KEY ("event_id")
      );
    `);
        this.addSql(`
      CREATE TABLE IF NOT EXISTS "gift_card_event" (
        "id" TEXT NOT NULL,
        "delivery_id" TEXT,
        "event" TEXT NOT NULL,
        "design_id" TEXT,
        "currency_code" TEXT,
        "amount" NUMERIC,
        "occurred_at" TIMESTAMPTZ NOT NULL,
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "gift_card_event_pkey" PRIMARY KEY ("id")
      );
    `);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_event_type_time" ON "gift_card_event" ("event", "occurred_at");`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_event_delivery_type" ON "gift_card_event" ("delivery_id", "event");`);
    }
    async down() {
        this.addSql(`DROP TABLE IF EXISTS "gift_card_event";`);
        this.addSql(`DROP TABLE IF EXISTS "gift_card_webhook_event";`);
        this.addSql(`DROP TABLE IF EXISTS "gift_card_delivery_attempt";`);
        this.addSql(`DROP TABLE IF EXISTS "gift_card_delivery";`);
        this.addSql(`DROP TABLE IF EXISTS "gift_card_settings";`);
        this.addSql(`DROP TABLE IF EXISTS "gift_card_design";`);
    }
}
exports.Migration20260719160000GiftCardExperience = Migration20260719160000GiftCardExperience;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MTkxNjAwMDBHaWZ0Q2FyZEV4cGVyaWVuY2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9naWZ0LWNhcmQtZXhwZXJpZW5jZS9taWdyYXRpb25zL01pZ3JhdGlvbjIwMjYwNzE5MTYwMDAwR2lmdENhcmRFeHBlcmllbmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlFQUFxRTtBQUVyRSxNQUFhLHlDQUEwQyxTQUFRLHNCQUFTO0lBQzdELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0tBa0JYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQUMsb0lBQW9JLENBQUMsQ0FBQztRQUNsSixJQUFJLENBQUMsTUFBTSxDQUFDLGdIQUFnSCxDQUFDLENBQUM7UUFFOUgsSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztLQXlCWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsTUFBTSxDQUFDLDRJQUE0SSxDQUFDLENBQUM7UUFFMUosSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7S0FxRFgsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnSkFBZ0osQ0FBQyxDQUFDO1FBQzlKLElBQUksQ0FBQyxNQUFNLENBQUMsa0tBQWtLLENBQUMsQ0FBQztRQUNoTCxJQUFJLENBQUMsTUFBTSxDQUFDLG9JQUFvSSxDQUFDLENBQUM7UUFDbEosSUFBSSxDQUFDLE1BQU0sQ0FBQyx5R0FBeUcsQ0FBQyxDQUFDO1FBQ3ZILElBQUksQ0FBQyxNQUFNLENBQUMsMEhBQTBILENBQUMsQ0FBQztRQUN4SSxJQUFJLENBQUMsTUFBTSxDQUFDLG9JQUFvSSxDQUFDLENBQUM7UUFFbEosSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0tBcUJYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQUMsNEpBQTRKLENBQUMsQ0FBQztRQUMxSyxJQUFJLENBQUMsTUFBTSxDQUFDLHNIQUFzSCxDQUFDLENBQUM7UUFFcEksSUFBSSxDQUFDLE1BQU0sQ0FBQzs7Ozs7Ozs7OztLQVVYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQUM7Ozs7Ozs7Ozs7Ozs7OztLQWVYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxNQUFNLENBQUMsMkdBQTJHLENBQUMsQ0FBQztRQUN6SCxJQUFJLENBQUMsTUFBTSxDQUFDLCtHQUErRyxDQUFDLENBQUM7SUFDL0gsQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMseUNBQXlDLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxDQUFDLGlEQUFpRCxDQUFDLENBQUM7UUFDL0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO1FBQ2xFLElBQUksQ0FBQyxNQUFNLENBQUMsNENBQTRDLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsTUFBTSxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLE1BQU0sQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0lBQzFELENBQUM7Q0FDRjtBQWpMRCw4RkFpTEMifQ==