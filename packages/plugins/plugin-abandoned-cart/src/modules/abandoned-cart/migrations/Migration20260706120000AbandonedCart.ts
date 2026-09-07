import { Migration } from '@mikro-orm/migrations';

export class Migration20260706120000AbandonedCart extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "abandoned_cart" (
        "id"                 TEXT        NOT NULL,
        "cart_id"            TEXT        NOT NULL,
        "email"              TEXT,
        "phone"              TEXT,
        "customer_id"        TEXT,
        "sales_channel_id"   TEXT,
        "cart_total"         NUMERIC,
        "currency_code"      TEXT,
        "status"             TEXT        NOT NULL DEFAULT 'pending',
        "last_step_sent"     INTEGER     NOT NULL DEFAULT 0,
        "next_eligible_at"   TIMESTAMPTZ,
        "last_activity_at"   TIMESTAMPTZ,
        "recovered_order_id" TEXT,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "abandoned_cart_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_abandoned_cart_cart_id" ON "abandoned_cart" ("cart_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_status" ON "abandoned_cart" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_next_eligible_at" ON "abandoned_cart" ("next_eligible_at") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_deleted_at" ON "abandoned_cart" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "abandoned_cart_notification" (
        "id"                TEXT        NOT NULL,
        "abandoned_cart_id" TEXT        NOT NULL,
        "step"              INTEGER     NOT NULL,
        "channel"           TEXT        NOT NULL,
        "template"          TEXT,
        "recipient"         TEXT,
        "status"            TEXT        NOT NULL DEFAULT 'sent',
        "error"             TEXT,
        "sent_at"           TIMESTAMPTZ,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "abandoned_cart_notification_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_cart" ON "abandoned_cart_notification" ("abandoned_cart_id");`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_step_channel" ON "abandoned_cart_notification" ("abandoned_cart_id", "step", "channel") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_abandoned_cart_notification_deleted_at" ON "abandoned_cart_notification" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "abandoned_cart_notification";`);
    this.addSql(`DROP TABLE IF EXISTS "abandoned_cart";`);
  }
}
