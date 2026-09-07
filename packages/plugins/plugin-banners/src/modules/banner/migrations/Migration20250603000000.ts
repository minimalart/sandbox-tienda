import { Migration } from '@mikro-orm/migrations';

export class Migration20250603000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner" (
        "id"            TEXT         NOT NULL,
        "internal_name" TEXT,
        "handle"        TEXT,
        "type"          TEXT,
        "device_type"   TEXT,
        "placement"     TEXT         NOT NULL,
        "status"        TEXT         NOT NULL DEFAULT 'draft',
        "priority"      INTEGER      NOT NULL DEFAULT 0,
        "content"       JSONB,
        "media"         JSONB,
        "cta"           JSONB,
        "metadata"      JSONB,
        "start_at"      TIMESTAMPTZ,
        "end_at"        TIMESTAMPTZ,
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMPTZ,
        CONSTRAINT "banner_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_placement" ON "banner" ("placement");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_status" ON "banner" ("status");`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_banner_deleted_at" ON "banner" ("deleted_at");`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "banner";`);
  }
}
