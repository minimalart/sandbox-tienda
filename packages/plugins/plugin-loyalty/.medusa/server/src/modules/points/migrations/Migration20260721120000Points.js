"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260721120000Points = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
// Loyalty Engine — Fase 1: evoluciona el ledger de puntos.
// Idempotente (IF NOT EXISTS / DROP IF EXISTS / DO $$ … duplicate_object) para
// poder re-correr sin romper. Suma estados, idempotencia, expiración y las refs
// a las entidades del motor (program/earn_rule/campaign).
class Migration20260721120000Points extends migrations_1.Migration {
    async up() {
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
    async down() {
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
exports.Migration20260721120000Points = Migration20260721120000Points;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MjExMjAwMDBQb2ludHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wb2ludHMvbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcyMTEyMDAwMFBvaW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckUsMkRBQTJEO0FBQzNELCtFQUErRTtBQUMvRSxnRkFBZ0Y7QUFDaEYsMERBQTBEO0FBQzFELE1BQWEsNkJBQThCLFNBQVEsc0JBQVM7SUFFakQsS0FBSyxDQUFDLEVBQUU7UUFDZiwwRkFBMEY7UUFDMUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpSEFBaUgsQ0FBQyxDQUFDO1FBQy9ILElBQUksQ0FBQyxNQUFNLENBQUMsa0dBQWtHLENBQUMsQ0FBQztRQUNoSCxJQUFJLENBQUMsTUFBTSxDQUFDLG9HQUFvRyxDQUFDLENBQUM7UUFDbEgsSUFBSSxDQUFDLE1BQU0sQ0FBQyw2RkFBNkYsQ0FBQyxDQUFDO1FBQzNHLElBQUksQ0FBQyxNQUFNLENBQUMsK0ZBQStGLENBQUMsQ0FBQztRQUM3RyxJQUFJLENBQUMsTUFBTSxDQUFDLDhGQUE4RixDQUFDLENBQUM7UUFFNUcsaUVBQWlFO1FBQ2pFLElBQUksQ0FBQyxNQUFNLENBQUMsdUdBQXVHLENBQUMsQ0FBQztRQUNySCxJQUFJLENBQUMsTUFBTSxDQUFDLHFOQUFxTixDQUFDLENBQUM7UUFFbk8sMkJBQTJCO1FBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsdU5BQXVOLENBQUMsQ0FBQztRQUVyTyxvRkFBb0Y7UUFDcEYsSUFBSSxDQUFDLE1BQU0sQ0FBQyx5TEFBeUwsQ0FBQyxDQUFDO1FBRXZNLHVFQUF1RTtRQUN2RSxJQUFJLENBQUMsTUFBTSxDQUFDLHlIQUF5SCxDQUFDLENBQUM7UUFDdkksSUFBSSxDQUFDLE1BQU0sQ0FBQyxpSUFBaUksQ0FBQyxDQUFDO0lBQ2pKLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNqQixJQUFJLENBQUMsTUFBTSxDQUFDLHVFQUF1RSxDQUFDLENBQUM7UUFDckYsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxNQUFNLENBQUMsMkRBQTJELENBQUMsQ0FBQztRQUN6RSxJQUFJLENBQUMsTUFBTSxDQUFDLHlHQUF5RyxDQUFDLENBQUM7UUFDdkgsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1R0FBdUcsQ0FBQyxDQUFDO1FBQ3JILElBQUksQ0FBQyxNQUFNLENBQUMsZ01BQWdNLENBQUMsQ0FBQztRQUM5TSxJQUFJLENBQUMsTUFBTSxDQUFDLDRFQUE0RSxDQUFDLENBQUM7UUFDMUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO1FBQ25HLElBQUksQ0FBQyxNQUFNLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztRQUM5RixJQUFJLENBQUMsTUFBTSxDQUFDLGdGQUFnRixDQUFDLENBQUM7UUFDOUYsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrRkFBa0YsQ0FBQyxDQUFDO1FBQ2hHLElBQUksQ0FBQyxNQUFNLENBQUMsaUZBQWlGLENBQUMsQ0FBQztJQUNqRyxDQUFDO0NBRUY7QUF6Q0Qsc0VBeUNDIn0=