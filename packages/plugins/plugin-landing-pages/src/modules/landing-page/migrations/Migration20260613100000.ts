import { Migration } from '@mikro-orm/migrations';

export class Migration20260613100000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "landing_page" (
        "id"               TEXT        NOT NULL,
        "title"            TEXT        NOT NULL,
        "slug"             TEXT        NOT NULL,
        "status"           TEXT        NOT NULL DEFAULT 'draft',
        "description"      TEXT,
        "seo"              JSONB,
        "puck_data"        JSONB,
        "template"         TEXT,
        "locale"           TEXT,
        "sales_channel_id" TEXT,
        "metadata"         JSONB,
        "published_at"     TIMESTAMPTZ,
        "created_by"       TEXT,
        "updated_by"       TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "landing_page_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_landing_page_slug_unique" ON "landing_page" ("slug") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_status" ON "landing_page" ("status");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_locale" ON "landing_page" ("locale");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_published_at" ON "landing_page" ("published_at");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_status_slug" ON "landing_page" ("status", "slug");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_landing_page_deleted_at" ON "landing_page" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "landing_page";`);
  }
}
