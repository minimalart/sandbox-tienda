import { Migration } from '@mikro-orm/migrations';

/**
 * M5 — Proof of Delivery: tabla proof_of_delivery.
 *
 * Evidencia de entrega (foto/firma/pin/geo/note) asociada 1:N a una
 * DeliveryExecution por `delivery_execution_id` (FK lógica del mismo módulo,
 * sin constraint cross-tabla, igual que tracking_event).
 *
 * Reversible: down() borra solo esta tabla. NO toca delivery_execution,
 * tracking_event, driver, vehicle ni nada de Andreani / M1-M4.
 */
export class Migration20260622150000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "proof_of_delivery" (
        "id"                    TEXT        NOT NULL,
        "delivery_execution_id" TEXT        NOT NULL,
        "type"                  TEXT        NOT NULL,
        "file_url"              TEXT,
        "signature_url"         TEXT,
        "captured_lat"          REAL,
        "captured_lng"          REAL,
        "captured_by"           TEXT,
        "pin_validated"         BOOLEAN,
        "note"                  TEXT,
        "captured_at"           TIMESTAMPTZ NOT NULL,
        "metadata"              JSONB,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMPTZ,
        CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_proof_of_delivery_execution" ON "proof_of_delivery" ("delivery_execution_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_proof_of_delivery_type" ON "proof_of_delivery" ("type") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_proof_of_delivery_deleted_at" ON "proof_of_delivery" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "proof_of_delivery" CASCADE;`);
  }
}
