import { Migration } from '@mikro-orm/migrations';

export class Migration20260603000000 extends Migration {
  async up(): Promise<void> {
    // Banner: rules column + composite indexes
    this.addSql(`ALTER TABLE IF EXISTS "banner" ADD COLUMN IF NOT EXISTS "rules" JSONB;`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_placement_status_priority" ON "banner" ("placement", "status", "priority");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_start_at_end_at" ON "banner" ("start_at", "end_at");`,
    );

    // Banner analytics
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner_analytics" (
        "id"                 TEXT         NOT NULL,
        "banner_id"          TEXT         NOT NULL,
        "impressions"        INTEGER      NOT NULL DEFAULT 0,
        "clicks"             INTEGER      NOT NULL DEFAULT 0,
        "last_impression_at" TIMESTAMPTZ,
        "last_click_at"      TIMESTAMPTZ,
        "created_at"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "banner_analytics_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_analytics_banner_id" ON "banner_analytics" ("banner_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_analytics_deleted_at" ON "banner_analytics" ("deleted_at");`,
    );

    // Banner audit
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "banner_audit" (
        "id"         TEXT         NOT NULL,
        "banner_id"  TEXT         NOT NULL,
        "action"     TEXT         NOT NULL,
        "user_id"    TEXT,
        "changes"    JSONB,
        "snapshot"   JSONB,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "banner_audit_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_audit_banner_id" ON "banner_audit" ("banner_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_banner_audit_deleted_at" ON "banner_audit" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "banner_audit";`);
    this.addSql(`DROP TABLE IF EXISTS "banner_analytics";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_banner_start_at_end_at";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_banner_placement_status_priority";`);
    this.addSql(`ALTER TABLE IF EXISTS "banner" DROP COLUMN IF EXISTS "rules";`);
  }
}
