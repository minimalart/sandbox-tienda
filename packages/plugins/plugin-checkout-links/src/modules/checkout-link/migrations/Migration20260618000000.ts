import { Migration } from '@mikro-orm/migrations';

export class Migration20260618000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "checkout_link" (
        "id"               TEXT         NOT NULL,
        "token"            TEXT         NOT NULL,
        "internal_name"    TEXT,
        "items"            JSONB        NOT NULL,
        "country_code"     TEXT         NOT NULL,
        "region_id"        TEXT,
        "sales_channel_id" TEXT,
        "email"            TEXT,
        "shipping_address" JSONB,
        "promo_codes"      JSONB,
        "status"           TEXT         NOT NULL DEFAULT 'active',
        "single_use"       BOOLEAN      NOT NULL DEFAULT FALSE,
        "used_count"       INTEGER      NOT NULL DEFAULT 0,
        "expires_at"       TIMESTAMPTZ,
        "created_by"       TEXT,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "checkout_link_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_checkout_link_token_unique" ON "checkout_link" ("token") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_checkout_link_token" ON "checkout_link" ("token");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_checkout_link_status" ON "checkout_link" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_checkout_link_deleted_at" ON "checkout_link" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "checkout_link";`);
  }
}
