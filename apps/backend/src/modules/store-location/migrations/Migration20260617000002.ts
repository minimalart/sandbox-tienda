import { Migration } from '@mikro-orm/migrations';

/**
 * Phase 4 — per-branch delivery settings (informational; shipping options stay
 * native to Medusa). One row per branch.
 */
export class Migration20260617000002 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "branch_delivery" (
        "id"                TEXT         NOT NULL,
        "store_location_id" TEXT         NOT NULL,
        "timezone"          TEXT,
        "lead_time_hours"   INTEGER,
        "active"            BOOLEAN      NOT NULL DEFAULT TRUE,
        "schedules"         JSONB,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "branch_delivery_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branch_delivery_store_location_id" ON "branch_delivery" ("store_location_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_branch_delivery_deleted_at" ON "branch_delivery" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "branch_delivery";`);
  }
}
