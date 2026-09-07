import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Cuenta corriente B2B (crédito comercial). Crea las tablas del módulo
 * `company_credit`: la cuenta por empresa y el ledger append-only de movimientos.
 * Idempotente (IF NOT EXISTS) para poder re-correr sin romper.
 */
export class Migration20260705120000CompanyCredit extends Migration {
  override async up(): Promise<void> {
    // Cuenta corriente (una por empresa).
    this.addSql(
      `create table if not exists "company_credit_account" ("id" text not null, "company_id" text not null, "status" text not null default 'active', "currency_code" text not null default 'ars', "credit_limit" integer not null default 0, "current_balance" integer not null default 0, "payment_terms_days" integer null, "notes" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "company_credit_account_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_company_credit_account_company_id_unique" ON "company_credit_account" ("company_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_account_status" ON "company_credit_account" ("status") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_account_deleted_at" ON "company_credit_account" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    // Ledger de movimientos (append-only).
    this.addSql(
      `create table if not exists "company_credit_transaction" ("id" text not null, "company_id" text not null, "type" text not null, "amount" integer not null, "balance_before" integer not null, "balance_after" integer not null, "currency_code" text not null default 'ars', "order_id" text null, "created_by" text null, "notes" text null, "metadata" jsonb null, "account_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "company_credit_transaction_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_transaction_account_id" ON "company_credit_transaction" ("account_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_transaction_company_id" ON "company_credit_transaction" ("company_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_transaction_order_id" ON "company_credit_transaction" ("order_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_transaction_type" ON "company_credit_transaction" ("type") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_company_credit_transaction_deleted_at" ON "company_credit_transaction" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(
      `alter table if exists "company_credit_transaction" drop constraint if exists "company_credit_transaction_account_id_foreign";`,
    );
    this.addSql(
      `alter table if exists "company_credit_transaction" add constraint "company_credit_transaction_account_id_foreign" foreign key ("account_id") references "company_credit_account" ("id") on update cascade;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "company_credit_transaction" drop constraint if exists "company_credit_transaction_account_id_foreign";`,
    );
    this.addSql(`drop table if exists "company_credit_transaction" cascade;`);
    this.addSql(`drop table if exists "company_credit_account" cascade;`);
  }
}
