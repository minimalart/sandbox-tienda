import { Migration } from '@mikro-orm/migrations';

/**
 * Phase 1 — branch coverage polygons (decoupled from fulfillment).
 */
export class Migration20260617000001 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "branch_coverage" (
        "id"                TEXT         NOT NULL,
        "store_location_id" TEXT         NOT NULL,
        "name"              TEXT         NOT NULL,
        "polygon"           JSONB        NOT NULL,
        "priority"          INTEGER      NOT NULL DEFAULT 0,
        "active"            BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "branch_coverage_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branch_coverage_store_location_id" ON "branch_coverage" ("store_location_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branch_coverage_active_deleted_at" ON "branch_coverage" ("active", "deleted_at");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branch_coverage_deleted_at" ON "branch_coverage" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "branch_coverage";`);
  }
}
