import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Historial de sincronizaciones de Typesense: `typesense_sync_log` (una fila por
 * corrida) + `typesense_sync_log_item` (detalle SÓLO de lo que pide atención).
 *
 * Antes el progreso vivía en un singleton de módulo de la ruta admin: se perdía
 * en cada restart, era incorrecto con más de un contenedor y cerrar la pestaña
 * dejaba la corrida huérfana sin forma de re-enganchar.
 *
 * `mode`, `trigger` y `status` van como TEXT (no enum de Postgres) igual que en
 * `erp_sync_log`: ampliar los valores no obliga a migrar el tipo.
 *
 * Idempotente (`IF NOT EXISTS`): se puede correr sobre una base que ya la tenga.
 */
export class Migration20260731120000TypesenseSyncLog extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "typesense_sync_log" (
        "id"          TEXT        NOT NULL,
        "mode"        TEXT        NOT NULL,
        "trigger"     TEXT        NOT NULL DEFAULT 'manual',
        "status"      TEXT        NOT NULL DEFAULT 'running',
        "stage"       TEXT,
        "collection"  TEXT,
        "started_at"  TIMESTAMPTZ NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "summary"     JSONB,
        "error"       JSONB,
        "created_by"  TEXT,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "typesense_sync_log_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_mode_status" ON "typesense_sync_log" ("mode", "status");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_started_at" ON "typesense_sync_log" ("started_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_deleted_at" ON "typesense_sync_log" ("deleted_at");`
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "typesense_sync_log_item" (
        "id"          TEXT        NOT NULL,
        "sync_log_id" TEXT        NOT NULL,
        "entity_type" TEXT        NOT NULL DEFAULT 'product',
        "entity_id"   TEXT        NOT NULL,
        "status"      TEXT        NOT NULL,
        "error"       TEXT,
        "payload"     JSONB,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMPTZ,
        CONSTRAINT "typesense_sync_log_item_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_item_sync_log_id_status" ON "typesense_sync_log_item" ("sync_log_id", "status");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_item_entity_id" ON "typesense_sync_log_item" ("entity_id");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_typesense_sync_log_item_deleted_at" ON "typesense_sync_log_item" ("deleted_at");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "typesense_sync_log_item" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "typesense_sync_log" CASCADE;`);
  }
}
