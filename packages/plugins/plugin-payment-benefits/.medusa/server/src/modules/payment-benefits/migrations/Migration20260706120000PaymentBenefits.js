"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260706120000PaymentBenefits = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Beneficios de Pago. Crea las tablas del módulo `payment_benefits`:
 * beneficios curados, catálogo crudo de medios de pago sincronizado, y log de
 * sincronización. Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
class Migration20260706120000PaymentBenefits extends migrations_1.Migration {
    async up() {
        // Beneficios curados (manuales o sincronizados).
        this.addSql(`create table if not exists "payment_benefit" ("id" text not null, "provider_code" text not null default 'manual', "external_id" text null, "title" text not null, "description" text null, "benefit_type" text not null default 'custom', "discount_type" text null, "discount_value" numeric null, "max_installments" integer null, "interest_rate" numeric null, "max_refund" numeric null, "minimum_amount" numeric null, "maximum_amount" numeric null, "source" text not null default 'manual', "read_only" boolean not null default false, "status" text not null default 'draft', "priority" integer not null default 0, "valid_from" timestamptz null, "valid_to" timestamptz null, "eligibility" jsonb null, "conditions" jsonb null, "sales_channel_ids" jsonb null, "admin_notes" text null, "hidden" boolean not null default false, "last_synced_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_benefit_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_benefit_status" ON "payment_benefit" ("status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_benefit_provider_code" ON "payment_benefit" ("provider_code") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_benefit_benefit_type" ON "payment_benefit" ("benefit_type") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_benefit_deleted_at" ON "payment_benefit" ("deleted_at") WHERE deleted_at IS NULL;`);
        // Catálogo crudo de medios de pago sincronizado del proveedor.
        this.addSql(`create table if not exists "payment_method_catalog" ("id" text not null, "provider_code" text not null default 'mercadopago', "external_id" text not null, "name" text not null, "payment_type_id" text null, "status" text null, "thumbnail_url" text null, "min_allowed_amount" numeric null, "max_allowed_amount" numeric null, "max_interest_free_installments" integer null, "raw" jsonb null, "last_synced_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_method_catalog_pkey" primary key ("id"));`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_method_catalog_provider_external_unique" ON "payment_method_catalog" ("provider_code", "external_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_catalog_deleted_at" ON "payment_method_catalog" ("deleted_at") WHERE deleted_at IS NULL;`);
        // Log de sincronizaciones.
        this.addSql(`create table if not exists "payment_sync_log" ("id" text not null, "provider_code" text not null, "status" text not null default 'ok', "items_synced" integer not null default 0, "message" text null, "started_at" timestamptz null, "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_sync_log_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_sync_log_provider_code" ON "payment_sync_log" ("provider_code") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_sync_log_status" ON "payment_sync_log" ("status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_sync_log_deleted_at" ON "payment_sync_log" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "payment_sync_log" cascade;`);
        this.addSql(`drop table if exists "payment_method_catalog" cascade;`);
        this.addSql(`drop table if exists "payment_benefit" cascade;`);
    }
}
exports.Migration20260706120000PaymentBenefits = Migration20260706120000PaymentBenefits;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MDYxMjAwMDBQYXltZW50QmVuZWZpdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA3MDYxMjAwMDBQYXltZW50QmVuZWZpdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7O0dBSUc7QUFDSCxNQUFhLHNDQUF1QyxTQUFRLHNCQUFTO0lBQzFELEtBQUssQ0FBQyxFQUFFO1FBQ2YsaURBQWlEO1FBQ2pELElBQUksQ0FBQyxNQUFNLENBQ1Qsb2lDQUFvaUMsQ0FDcmlDLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG1IQUFtSCxDQUNwSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxpSUFBaUksQ0FDbEksQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsK0hBQStILENBQ2hJLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDJIQUEySCxDQUM1SCxDQUFDO1FBRUYsK0RBQStEO1FBQy9ELElBQUksQ0FBQyxNQUFNLENBQ1QsdW1CQUF1bUIsQ0FDeG1CLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULGdMQUFnTCxDQUNqTCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCx5SUFBeUksQ0FDMUksQ0FBQztRQUVGLDJCQUEyQjtRQUMzQixJQUFJLENBQUMsTUFBTSxDQUNULGdjQUFnYyxDQUNqYyxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxtSUFBbUksQ0FDcEksQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QscUhBQXFILENBQ3RILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDZIQUE2SCxDQUM5SCxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsTUFBTSxDQUFDLHdEQUF3RCxDQUFDLENBQUM7UUFDdEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7Q0FDRjtBQWxERCx3RkFrREMifQ==