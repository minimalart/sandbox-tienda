import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Setup inicial del módulo ERP: config, logs de sincronización (+ detalle por
 * SKU) y outbox de eventos hacia el ERP. Idempotente (IF NOT EXISTS).
 */
export class Migration20260704120000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_config" (
        "id"                    TEXT        NOT NULL,
        "provider"              TEXT        NOT NULL,
        "country_code"          TEXT        NOT NULL DEFAULT 'AR',
        "enabled"               BOOLEAN     NOT NULL DEFAULT FALSE,
        "stock_sync_enabled"    BOOLEAN     NOT NULL DEFAULT FALSE,
        "sales_notify_enabled"  BOOLEAN     NOT NULL DEFAULT FALSE,
        "credentials_enc"       TEXT,
        "settings"              JSONB,
        "last_validated_at"     TIMESTAMPTZ,
        "last_validation_ok"    BOOLEAN,
        "last_validation_error" TEXT,
        "updated_by"            TEXT,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "erp_config_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_config_provider_unique" ON "erp_config" ("provider") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_config_deleted_at" ON "erp_config" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_sync_log" (
        "id"          TEXT        NOT NULL,
        "type"        TEXT        NOT NULL,
        "provider"    TEXT        NOT NULL,
        "trigger"     TEXT        NOT NULL DEFAULT 'cron',
        "status"      TEXT        NOT NULL DEFAULT 'running',
        "started_at"  TIMESTAMPTZ NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "summary"     JSONB,
        "error"       JSONB,
        "created_by"  TEXT,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "erp_sync_log_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_type_status" ON "erp_sync_log" ("type", "status");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_started_at" ON "erp_sync_log" ("started_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_deleted_at" ON "erp_sync_log" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_sync_log_item" (
        "id"               TEXT        NOT NULL,
        "sync_log_id"      TEXT        NOT NULL,
        "entity_type"      TEXT        NOT NULL DEFAULT 'variant_sku',
        "entity_id"        TEXT        NOT NULL,
        "status"           TEXT        NOT NULL,
        "request_payload"  JSONB,
        "response_payload" JSONB,
        "error"            TEXT,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "erp_sync_log_item_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_item_sync_log_id_status" ON "erp_sync_log_item" ("sync_log_id", "status");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_item_entity_id" ON "erp_sync_log_item" ("entity_id");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_sync_log_item_deleted_at" ON "erp_sync_log_item" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_outbox_event" (
        "id"               TEXT        NOT NULL,
        "event_type"       TEXT        NOT NULL,
        "event_key"        TEXT        NOT NULL,
        "aggregate_type"   TEXT        NOT NULL DEFAULT 'order',
        "aggregate_id"     TEXT        NOT NULL,
        "provider"         TEXT        NOT NULL,
        "payload"          JSONB,
        "status"           TEXT        NOT NULL DEFAULT 'pending',
        "attempts"         INTEGER     NOT NULL DEFAULT 0,
        "next_retry_at"    TIMESTAMPTZ,
        "claimed_at"       TIMESTAMPTZ,
        "sent_at"          TIMESTAMPTZ,
        "external_ref"     TEXT,
        "last_error"       TEXT,
        "response_payload" JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "erp_outbox_event_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_outbox_event_event_key_unique" ON "erp_outbox_event" ("event_key") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_outbox_event_status_next_retry_at" ON "erp_outbox_event" ("status", "next_retry_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_outbox_event_aggregate_id" ON "erp_outbox_event" ("aggregate_id");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_outbox_event_deleted_at" ON "erp_outbox_event" ("deleted_at");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "erp_outbox_event";`);
    this.addSql(`DROP TABLE IF EXISTS "erp_sync_log_item";`);
    this.addSql(`DROP TABLE IF EXISTS "erp_sync_log";`);
    this.addSql(`DROP TABLE IF EXISTS "erp_config";`);
  }
}
