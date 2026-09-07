import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// Loyalty Engine — Fase 1: evoluciona el ledger de puntos.
// Idempotente (IF NOT EXISTS / DROP IF EXISTS / DO $$ … duplicate_object) para
// poder re-correr sin romper. Suma estados, idempotencia, expiración y las refs
// a las entidades del motor (program/earn_rule/campaign).
export class Migration20260721120000Points extends Migration {

  override async up(): Promise<void> {
    // Columnas nuevas. `status` NOT NULL con default → backfillea filas viejas a 'available'.
    this.addSql(`alter table if exists "points_transaction" add column if not exists "status" text not null default 'available';`);
    this.addSql(`alter table if exists "points_transaction" add column if not exists "idempotency_key" text null;`);
    this.addSql(`alter table if exists "points_transaction" add column if not exists "expires_at" timestamptz null;`);
    this.addSql(`alter table if exists "points_transaction" add column if not exists "program_id" text null;`);
    this.addSql(`alter table if exists "points_transaction" add column if not exists "earn_rule_id" text null;`);
    this.addSql(`alter table if exists "points_transaction" add column if not exists "campaign_id" text null;`);

    // Extender el check del enum `type` para incluir reverse/expire.
    this.addSql(`alter table if exists "points_transaction" drop constraint if exists "points_transaction_type_check";`);
    this.addSql(`do $$ begin alter table "points_transaction" add constraint "points_transaction_type_check" check ("type" in ('earn', 'redeem', 'adjust', 'reverse', 'expire')); exception when duplicate_object then null; end $$;`);

    // Check del enum `status`.
    this.addSql(`do $$ begin alter table "points_transaction" add constraint "points_transaction_status_check" check ("status" in ('pending', 'available', 'expired', 'reversed')); exception when duplicate_object then null; end $$;`);

    // Idempotencia: a lo sumo una fila viva por clave (los NULL son siempre distintos).
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_points_transaction_idempotency_key_unique" ON "points_transaction" ("idempotency_key") WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;`);

    // Índices de apoyo para el cálculo de balance y el job de vencimiento.
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_points_transaction_status" ON "points_transaction" ("status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_points_transaction_expires_at" ON "points_transaction" ("expires_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_points_transaction_idempotency_key_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_points_transaction_status";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_points_transaction_expires_at";`);
    this.addSql(`alter table if exists "points_transaction" drop constraint if exists "points_transaction_status_check";`);
    this.addSql(`alter table if exists "points_transaction" drop constraint if exists "points_transaction_type_check";`);
    this.addSql(`do $$ begin alter table "points_transaction" add constraint "points_transaction_type_check" check ("type" in ('earn', 'redeem', 'adjust')); exception when duplicate_object then null; end $$;`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "status";`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "idempotency_key";`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "expires_at";`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "program_id";`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "earn_rule_id";`);
    this.addSql(`alter table if exists "points_transaction" drop column if exists "campaign_id";`);
  }

}
