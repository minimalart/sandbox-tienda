import { Migration } from '@mikro-orm/migrations';

export class Migration20260616120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "email_template" (
        "id"           TEXT        NOT NULL,
        "key"          TEXT        NOT NULL,
        "name"         TEXT        NOT NULL,
        "description"  TEXT,
        "subject"      TEXT        NOT NULL,
        "html"         TEXT        NOT NULL,
        "status"       TEXT        NOT NULL DEFAULT 'draft',
        "locale"       TEXT,
        "variables"    JSONB,
        "sample_data"  JSONB,
        "metadata"     JSONB,
        "published_at" TIMESTAMPTZ,
        "created_by"   TEXT,
        "updated_by"   TEXT,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMPTZ,
        CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_email_template_key_unique" ON "email_template" ("key") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_template_status" ON "email_template" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_template_locale" ON "email_template" ("locale");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_template_status_key" ON "email_template" ("status", "key");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_template_deleted_at" ON "email_template" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "email_template";`);
  }
}
