import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260619160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "oauth_client" (
        "id" text not null,
        "client_name" text null,
        "redirect_uris" jsonb not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "oauth_client_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_oauth_client_deleted_at" ON "oauth_client" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "oauth_code" (
        "id" text not null,
        "code_hash" text not null,
        "client_id" text not null,
        "redirect_uri" text not null,
        "scope" text null,
        "code_challenge" text not null,
        "admin_id" text not null,
        "expires_at" timestamptz not null,
        "used" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "oauth_code_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oauth_code_code_hash_unique" ON "oauth_code" ("code_hash") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_oauth_code_deleted_at" ON "oauth_code" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "oauth_token" (
        "id" text not null,
        "token_hash" text not null,
        "token_prefix" text not null,
        "refresh_hash" text null,
        "client_id" text not null,
        "scope" text null,
        "admin_id" text not null,
        "expires_at" timestamptz not null,
        "revoked" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "oauth_token_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oauth_token_token_hash_unique" ON "oauth_token" ("token_hash") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oauth_token_refresh_hash_unique" ON "oauth_token" ("refresh_hash") WHERE deleted_at IS NULL AND refresh_hash IS NOT NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_oauth_token_deleted_at" ON "oauth_token" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "oauth_code" cascade;`);
    this.addSql(`drop table if exists "oauth_token" cascade;`);
    this.addSql(`drop table if exists "oauth_client" cascade;`);
  }
}
