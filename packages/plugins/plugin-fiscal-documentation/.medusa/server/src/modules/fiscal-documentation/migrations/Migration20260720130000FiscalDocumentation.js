"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260720130000FiscalDocumentation = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
/**
 * Documentación Fiscal — tabla de constancias fiscales versionadas, compartida
 * por las extensiones corporate y company (owner polimórfico).
 * Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
class Migration20260720130000FiscalDocumentation extends migrations_1.Migration {
    async up() {
        this.addSql(`create table if not exists "fiscal_document" ("id" text not null, "owner_type" text not null, "owner_id" text not null, "type" text not null default 'constancia', "status" text not null default 'vigente', "source" text not null default 'arca', "tax_id" text not null, "file_id" text null, "file_url" text null, "snapshot" jsonb not null, "snapshot_hash" text not null, "requested_by" text null, "generated_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fiscal_document_pkey" primary key ("id"));`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_owner" ON "fiscal_document" ("owner_type", "owner_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_status" ON "fiscal_document" ("status") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_snapshot_hash" ON "fiscal_document" ("snapshot_hash") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_tax_id" ON "fiscal_document" ("tax_id") WHERE deleted_at IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_deleted_at" ON "fiscal_document" ("deleted_at") WHERE deleted_at IS NULL;`);
    }
    async down() {
        this.addSql(`drop table if exists "fiscal_document" cascade;`);
    }
}
exports.Migration20260720130000FiscalDocumentation = Migration20260720130000FiscalDocumentation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA3MjAxMzAwMDBGaXNjYWxEb2N1bWVudGF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvZmlzY2FsLWRvY3VtZW50YXRpb24vbWlncmF0aW9ucy9NaWdyYXRpb24yMDI2MDcyMDEzMDAwMEZpc2NhbERvY3VtZW50YXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7O0dBSUc7QUFDSCxNQUFhLDBDQUEyQyxTQUFRLHNCQUFTO0lBQzlELEtBQUssQ0FBQyxFQUFFO1FBQ2YsSUFBSSxDQUFDLE1BQU0sQ0FDVCw0bkJBQTRuQixDQUM3bkIsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Qsa0lBQWtJLENBQ25JLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULG1IQUFtSCxDQUNwSCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVCxpSUFBaUksQ0FDbEksQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1QsbUhBQW1ILENBQ3BILENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULDJIQUEySCxDQUM1SCxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsaURBQWlELENBQUMsQ0FBQztJQUNqRSxDQUFDO0NBQ0Y7QUF6QkQsZ0dBeUJDIn0=