import { Migration } from '@medusajs/framework/mikro-orm/migrations';

export class Migration20260619120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "chat_thread" (
        "id" text not null,
        "title" text not null,
        "status" text check ("status" in ('active', 'archived')) not null default 'active',
        "created_by" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "chat_thread_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_thread_created_by" ON "chat_thread" ("created_by") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_thread_deleted_at" ON "chat_thread" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "chat_message" (
        "id" text not null,
        "thread_id" text not null,
        "role" text check ("role" in ('system', 'user', 'assistant', 'tool')) not null,
        "content" text null,
        "tool_calls" jsonb null,
        "tool_call_id" text null,
        "status" text check ("status" in ('complete', 'pending')) null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "chat_message_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_message_thread_id" ON "chat_message" ("thread_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_chat_message_deleted_at" ON "chat_message" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "ai_tool_policy" (
        "id" text not null,
        "tool_name" text not null,
        "action" text not null,
        "mode" text check ("mode" in ('auto', 'ask', 'prohibited')) not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_tool_policy_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_tool_policy_tool_action_unique" ON "ai_tool_policy" ("tool_name", "action") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_tool_policy_deleted_at" ON "ai_tool_policy" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "chat_message" cascade;`);
    this.addSql(`drop table if exists "chat_thread" cascade;`);
    this.addSql(`drop table if exists "ai_tool_policy" cascade;`);
  }
}
