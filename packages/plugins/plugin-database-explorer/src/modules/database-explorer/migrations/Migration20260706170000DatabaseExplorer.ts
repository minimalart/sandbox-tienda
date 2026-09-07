import { Migration } from '@mikro-orm/migrations';

export class Migration20260706170000DatabaseExplorer extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "database_explorer_table_config" (
        "id" TEXT NOT NULL,
        "table_name" TEXT NOT NULL,
        "display_name" TEXT,
        "description" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "show_in_visual" BOOLEAN NOT NULL DEFAULT TRUE,
        "primary_label_column" TEXT,
        "default_sort_column" TEXT,
        "default_sort_direction" TEXT NOT NULL DEFAULT 'desc',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "database_explorer_table_config_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_database_explorer_table_config_table_name" ON "database_explorer_table_config" ("table_name") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_table_config_enabled" ON "database_explorer_table_config" ("enabled");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_table_config_deleted_at" ON "database_explorer_table_config" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "database_explorer_column_config" (
        "id" TEXT NOT NULL,
        "table_name" TEXT NOT NULL,
        "column_name" TEXT NOT NULL,
        "display_name" TEXT,
        "data_type" TEXT,
        "visible" BOOLEAN NOT NULL DEFAULT FALSE,
        "masked" BOOLEAN NOT NULL DEFAULT FALSE,
        "searchable" BOOLEAN NOT NULL DEFAULT FALSE,
        "filterable" BOOLEAN NOT NULL DEFAULT FALSE,
        "sortable" BOOLEAN NOT NULL DEFAULT FALSE,
        "sensitive" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "database_explorer_column_config_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_database_explorer_column_config_table_column" ON "database_explorer_column_config" ("table_name", "column_name") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_column_config_table_name" ON "database_explorer_column_config" ("table_name");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_column_config_deleted_at" ON "database_explorer_column_config" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "database_explorer_relation_config" (
        "id" TEXT NOT NULL,
        "source_table" TEXT NOT NULL,
        "source_column" TEXT NOT NULL,
        "target_table" TEXT NOT NULL,
        "target_column" TEXT NOT NULL,
        "relation_type" TEXT NOT NULL DEFAULT 'many_to_one',
        "display_name" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "database_explorer_relation_config_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_relation_config_source" ON "database_explorer_relation_config" ("source_table", "source_column");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_relation_config_target" ON "database_explorer_relation_config" ("target_table", "target_column");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_relation_config_enabled" ON "database_explorer_relation_config" ("enabled");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_relation_config_deleted_at" ON "database_explorer_relation_config" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "database_explorer_saved_view" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "table_name" TEXT NOT NULL,
        "filters_json" JSONB,
        "columns_json" JSONB,
        "sort_json" JSONB,
        "role_ids_json" JSONB,
        "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "database_explorer_saved_view_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_saved_view_table_name" ON "database_explorer_saved_view" ("table_name");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_saved_view_enabled" ON "database_explorer_saved_view" ("enabled");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_saved_view_deleted_at" ON "database_explorer_saved_view" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "database_explorer_audit_log" (
        "id" TEXT NOT NULL,
        "user_id" TEXT,
        "action" TEXT NOT NULL,
        "table_name" TEXT,
        "record_id" TEXT,
        "view_id" TEXT,
        "filters_json" JSONB,
        "duration_ms" INTEGER,
        "success" BOOLEAN NOT NULL DEFAULT TRUE,
        "error_message" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "database_explorer_audit_log_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_audit_log_user_id" ON "database_explorer_audit_log" ("user_id");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_audit_log_table_name" ON "database_explorer_audit_log" ("table_name");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_audit_log_action" ON "database_explorer_audit_log" ("action");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_audit_log_created_at" ON "database_explorer_audit_log" ("created_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_database_explorer_audit_log_deleted_at" ON "database_explorer_audit_log" ("deleted_at");`
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "database_explorer_audit_log";`);
    this.addSql(`DROP TABLE IF EXISTS "database_explorer_saved_view";`);
    this.addSql(`DROP TABLE IF EXISTS "database_explorer_relation_config";`);
    this.addSql(`DROP TABLE IF EXISTS "database_explorer_column_config";`);
    this.addSql(`DROP TABLE IF EXISTS "database_explorer_table_config";`);
  }
}
