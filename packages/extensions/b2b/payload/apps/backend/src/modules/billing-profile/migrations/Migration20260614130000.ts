import { Migration } from '@mikro-orm/migrations';

export class Migration20260614130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "billing_profile" (
        "id"              TEXT        NOT NULL,
        "customer_id"     TEXT        NOT NULL,
        "label"           TEXT        NOT NULL,
        "invoice_type"    TEXT        NOT NULL DEFAULT 'invoice_a',
        "tax_condition"   TEXT        NOT NULL,
        "document_type"   TEXT        NOT NULL DEFAULT 'CUIT',
        "document_number" TEXT        NOT NULL,
        "legal_name"      TEXT        NOT NULL,
        "billing_email"   TEXT        NOT NULL,
        "billing_phone"   TEXT,
        "address_line_1"  TEXT        NOT NULL,
        "address_line_2"  TEXT,
        "city"            TEXT        NOT NULL,
        "province"        TEXT        NOT NULL,
        "postal_code"     TEXT        NOT NULL,
        "country_code"    TEXT        NOT NULL DEFAULT 'ar',
        "is_default"      BOOLEAN     NOT NULL DEFAULT FALSE,
        "metadata"        JSONB,
        "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"      TIMESTAMPTZ,
        CONSTRAINT "billing_profile_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_profile_customer" ON "billing_profile" ("customer_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_profile_is_default" ON "billing_profile" ("is_default");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_billing_profile_deleted_at" ON "billing_profile" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "billing_profile";`);
  }
}
