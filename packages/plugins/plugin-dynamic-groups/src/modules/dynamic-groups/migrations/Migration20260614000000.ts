import { Migration } from '@mikro-orm/migrations';

export class Migration20260614000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "dynamic_group" (
        "id"                TEXT        NOT NULL,
        "name"              TEXT        NOT NULL,
        "handle"            TEXT        NOT NULL,
        "description"       TEXT,
        "customer_group_id" TEXT,
        "match"             TEXT        NOT NULL DEFAULT 'all',
        "conditions"        JSONB       NOT NULL,
        "update_mode"       TEXT        NOT NULL DEFAULT 'realtime',
        "is_active"         BOOLEAN     NOT NULL DEFAULT TRUE,
        "last_run_at"       TIMESTAMPTZ,
        "last_run_stats"    JSONB,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "dynamic_group_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_handle" ON "dynamic_group" ("handle");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_is_active" ON "dynamic_group" ("is_active");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_customer_group_id" ON "dynamic_group" ("customer_group_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dynamic_group_deleted_at" ON "dynamic_group" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "dynamic_group_membership_log" (
        "id"                TEXT        NOT NULL,
        "dynamic_group_id"  TEXT        NOT NULL,
        "customer_id"       TEXT        NOT NULL,
        "action"            TEXT        NOT NULL,
        "reason"            JSONB,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMPTZ,
        CONSTRAINT "dynamic_group_membership_log_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dgml_group" ON "dynamic_group_membership_log" ("dynamic_group_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dgml_customer" ON "dynamic_group_membership_log" ("customer_id");`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_dgml_deleted_at" ON "dynamic_group_membership_log" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "dynamic_group_membership_log";`);
    this.addSql(`DROP TABLE IF EXISTS "dynamic_group";`);
  }
}
