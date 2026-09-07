import { Migration } from '@mikro-orm/migrations';

export class Migration20260614150000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "company" (
        "id"                         TEXT        NOT NULL,
        "name"                       TEXT        NOT NULL,
        "slug"                       TEXT        NOT NULL,
        "legal_name"                 TEXT,
        "tax_id"                     TEXT,
        "status"                     TEXT        NOT NULL DEFAULT 'active',
        "sales_channel_id"           TEXT,
        "customer_group_id"          TEXT,
        "price_list_id"              TEXT,
        "default_billing_profile_id" TEXT,
        "metadata"                   JSONB,
        "created_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"                 TIMESTAMPTZ,
        CONSTRAINT "company_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_slug" ON "company" ("slug");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_status" ON "company" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_sales_channel" ON "company" ("sales_channel_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_customer_group" ON "company" ("customer_group_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_deleted_at" ON "company" ("deleted_at");`);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "company_member" (
        "id"          TEXT        NOT NULL,
        "company_id"  TEXT        NOT NULL,
        "customer_id" TEXT        NOT NULL,
        "role"        TEXT        NOT NULL DEFAULT 'buyer',
        "status"      TEXT        NOT NULL DEFAULT 'active',
        "invited_by"  TEXT,
        "joined_at"   TIMESTAMPTZ,
        "metadata"    JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "company_member_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_member_company" ON "company_member" ("company_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_member_customer" ON "company_member" ("customer_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_member_status" ON "company_member" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_member_deleted_at" ON "company_member" ("deleted_at");`);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "company_invitation" (
        "id"          TEXT        NOT NULL,
        "company_id"  TEXT        NOT NULL,
        "email"       TEXT        NOT NULL,
        "role"        TEXT        NOT NULL DEFAULT 'buyer',
        "token"       TEXT        NOT NULL,
        "invited_by"  TEXT,
        "status"      TEXT        NOT NULL DEFAULT 'pending',
        "expires_at"  TIMESTAMPTZ,
        "accepted_at" TIMESTAMPTZ,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "company_invitation_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_invitation_token" ON "company_invitation" ("token");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_invitation_company" ON "company_invitation" ("company_id");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_invitation_email" ON "company_invitation" ("email");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_invitation_status" ON "company_invitation" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_company_invitation_deleted_at" ON "company_invitation" ("deleted_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "company_invitation";`);
    this.addSql(`DROP TABLE IF EXISTS "company_member";`);
    this.addSql(`DROP TABLE IF EXISTS "company";`);
  }
}
