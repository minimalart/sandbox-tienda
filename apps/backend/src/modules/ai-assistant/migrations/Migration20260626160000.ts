import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Trazabilidad: `ai_agent_run` (una corrida = turno de chat, análisis proactivo o
 * ejecución de propuesta) y `ai_agent_step` (cada llamada al modelo / tool / handoff).
 */
export class Migration20260626160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_agent_run" (
        "id" text not null,
        "thread_id" text null,
        "agent_key" text not null,
        "kind" text check ("kind" in ('chat', 'proactive', 'proposal_exec')) not null default 'chat',
        "status" text check ("status" in ('running', 'complete', 'needs_approval', 'error')) not null default 'running',
        "model" text null,
        "steps" integer not null default 0,
        "prompt_tokens" integer not null default 0,
        "completion_tokens" integer not null default 0,
        "duration_ms" integer null,
        "error" text null,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_agent_run_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_run_deleted_at" ON "ai_agent_run" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "ai_agent_step" (
        "id" text not null,
        "run_id" text not null,
        "idx" integer not null default 0,
        "type" text check ("type" in ('model', 'tool', 'handoff')) not null,
        "agent_key" text null,
        "name" text null,
        "status" text null,
        "duration_ms" integer null,
        "tokens" integer null,
        "detail" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_agent_step_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_step_run_id" ON "ai_agent_step" ("run_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_step_deleted_at" ON "ai_agent_step" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_agent_step" cascade;`);
    this.addSql(`drop table if exists "ai_agent_run" cascade;`);
  }
}
