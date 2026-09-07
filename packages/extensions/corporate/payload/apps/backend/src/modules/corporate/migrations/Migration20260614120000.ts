import { Migration } from '@mikro-orm/migrations';

export class Migration20260614120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "corporate" (
        "id"                TEXT        NOT NULL,
        "name"              TEXT        NOT NULL,
        "slug"              TEXT        NOT NULL,
        "legal_name"        TEXT,
        "tax_id"            TEXT,
        "email_domain"      TEXT,
        "status"            TEXT        NOT NULL DEFAULT 'pending',
        "customer_group_id" TEXT,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "corporate_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_corporate_slug" ON "corporate" ("slug");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_corporate_status" ON "corporate" ("status");`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_customer_group_id" ON "corporate" ("customer_group_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_email_domain" ON "corporate" ("email_domain");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_deleted_at" ON "corporate" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "corporate_member" (
        "id"           TEXT        NOT NULL,
        "corporate_id" TEXT        NOT NULL,
        "customer_id"  TEXT        NOT NULL,
        "role"         TEXT        NOT NULL DEFAULT 'buyer',
        "status"       TEXT        NOT NULL DEFAULT 'active',
        "invited_by"   TEXT,
        "joined_at"    TIMESTAMPTZ,
        "metadata"     JSONB,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "corporate_member_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_member_corporate" ON "corporate_member" ("corporate_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_member_customer" ON "corporate_member" ("customer_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_member_status" ON "corporate_member" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_member_deleted_at" ON "corporate_member" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "corporate_rule" (
        "id"           TEXT        NOT NULL,
        "corporate_id" TEXT        NOT NULL,
        "type"         TEXT        NOT NULL,
        "config"       JSONB       NOT NULL,
        "enabled"      BOOLEAN     NOT NULL DEFAULT TRUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "corporate_rule_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_rule_corporate" ON "corporate_rule" ("corporate_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_rule_type" ON "corporate_rule" ("type");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_rule_deleted_at" ON "corporate_rule" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "corporate_invitation" (
        "id"           TEXT        NOT NULL,
        "corporate_id" TEXT        NOT NULL,
        "email"        TEXT        NOT NULL,
        "role"         TEXT        NOT NULL DEFAULT 'buyer',
        "token"        TEXT        NOT NULL,
        "invited_by"   TEXT,
        "status"       TEXT        NOT NULL DEFAULT 'pending',
        "expires_at"   TIMESTAMPTZ,
        "accepted_at"  TIMESTAMPTZ,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "corporate_invitation_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_invitation_token" ON "corporate_invitation" ("token");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_invitation_corporate" ON "corporate_invitation" ("corporate_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_invitation_email" ON "corporate_invitation" ("email");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_invitation_status" ON "corporate_invitation" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_corporate_invitation_deleted_at" ON "corporate_invitation" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "corporate_invitation";`);
    this.addSql(`DROP TABLE IF EXISTS "corporate_rule";`);
    this.addSql(`DROP TABLE IF EXISTS "corporate_member";`);
    this.addSql(`DROP TABLE IF EXISTS "corporate";`);
  }
}
