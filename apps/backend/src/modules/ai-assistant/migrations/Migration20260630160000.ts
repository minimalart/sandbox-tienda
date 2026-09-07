import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Workflows orquestados: definición (`ai_workflow`) + corrida/estado (`ai_workflow_run`).
 */
export class Migration20260630160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_workflow" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "description" text null,
        "enabled" boolean not null default true,
        "steps" jsonb not null,
        "final_action" jsonb null,
        "source" text check ("source" in ('system', 'custom')) not null default 'custom',
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_workflow_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_workflow_key_unique" ON "ai_workflow" ("key") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_workflow_deleted_at" ON "ai_workflow" ("deleted_at") WHERE deleted_at IS NULL;`,
    );

    this.addSql(`
      create table if not exists "ai_workflow_run" (
        "id" text not null,
        "workflow_key" text not null,
        "thread_id" text null,
        "status" text check ("status" in ('running', 'needs_input', 'completed', 'failed')) not null default 'running',
        "input" jsonb null,
        "state" jsonb null,
        "checklist" jsonb null,
        "error" text null,
        "created_by" text null,
        "completed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_workflow_run_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_workflow_run_thread_id" ON "ai_workflow_run" ("thread_id") WHERE deleted_at IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_workflow_run_status" ON "ai_workflow_run" ("status") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_workflow_run" cascade;`);
    this.addSql(`drop table if exists "ai_workflow" cascade;`);
  }
}
