import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Documentación Fiscal — tabla de constancias fiscales versionadas, compartida
 * por las extensiones corporate y company (owner polimórfico).
 * Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
export class Migration20260720130000FiscalDocumentation extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "fiscal_document" ("id" text not null, "owner_type" text not null, "owner_id" text not null, "type" text not null default 'constancia', "status" text not null default 'vigente', "source" text not null default 'arca', "tax_id" text not null, "file_id" text null, "file_url" text null, "snapshot" jsonb not null, "snapshot_hash" text not null, "requested_by" text null, "generated_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fiscal_document_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_owner" ON "fiscal_document" ("owner_type", "owner_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_status" ON "fiscal_document" ("status") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_snapshot_hash" ON "fiscal_document" ("snapshot_hash") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_tax_id" ON "fiscal_document" ("tax_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_fiscal_document_deleted_at" ON "fiscal_document" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fiscal_document" cascade;`);
  }
}
