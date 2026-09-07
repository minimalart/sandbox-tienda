import { Migration } from '@mikro-orm/migrations';

/**
 * M6 — Zonas logísticas + Motor de reglas: tablas delivery_zone y delivery_rule.
 *
 * - delivery_zone: atributos operativos sobre una geometría existente. NO
 *   guarda polígono: referencia un BranchCoverage de store-location vía
 *   `branch_coverage_id` (FK lógica, sin constraint cross-tabla, igual patrón
 *   que delivery_execution.delivery_zone_id).
 * - delivery_rule: motor de reglas JSON-predicate (conditions + action) por zona
 *   o global (delivery_zone_id null).
 *
 * Reversible: down() borra solo estas dos tablas. NO toca delivery_execution ni
 * nada de M1-M5 ni del módulo store-location.
 */
export class Migration20260622160000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_zone" (
        "id"                 TEXT        NOT NULL,
        "name"               TEXT        NOT NULL,
        "store_location_id"  TEXT,
        "branch_coverage_id" TEXT,
        "pricing_tier"       TEXT,
        "sla_hours"          INTEGER,
        "cutoff_time"        TEXT,
        "enabled_providers"  JSONB,
        "priority"           INTEGER     NOT NULL DEFAULT 0,
        "active"             BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"           JSONB,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMPTZ,
        CONSTRAINT "delivery_zone_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_store_location" ON "delivery_zone" ("store_location_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_active" ON "delivery_zone" ("active") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_zone_deleted_at" ON "delivery_zone" ("deleted_at");`,
    );

    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_rule" (
        "id"               TEXT        NOT NULL,
        "name"             TEXT        NOT NULL,
        "delivery_zone_id" TEXT,
        "priority"         INTEGER     NOT NULL DEFAULT 0,
        "conditions"       JSONB       NOT NULL,
        "action"           JSONB       NOT NULL,
        "active"           BOOLEAN     NOT NULL DEFAULT TRUE,
        "metadata"         JSONB,
        "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMPTZ,
        CONSTRAINT "delivery_rule_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_rule_zone" ON "delivery_rule" ("delivery_zone_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_rule_active_priority" ON "delivery_rule" ("active", "priority") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_rule_deleted_at" ON "delivery_rule" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "delivery_rule" CASCADE;`);
    this.addSql(`DROP TABLE IF EXISTS "delivery_zone" CASCADE;`);
  }
}
