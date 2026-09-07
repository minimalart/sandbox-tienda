import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260619140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "mcp_api_key" (
        "id" text not null,
        "name" text not null,
        "token_hash" text not null,
        "token_prefix" text not null,
        "last_used_at" timestamptz null,
        "request_count" integer not null default 0,
        "revoked" boolean not null default false,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "mcp_api_key_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mcp_api_key_token_hash_unique" ON "mcp_api_key" ("token_hash") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_mcp_api_key_deleted_at" ON "mcp_api_key" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "mcp_api_key" cascade;`);
  }
}
