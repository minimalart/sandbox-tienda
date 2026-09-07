import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Cimientos de la plataforma de agentes: tablas declarativas `ai_skill` y
 * `ai_agent`, y la columna `active_agent_id` en `chat_thread` (agente activo del
 * hilo, que se actualiza en cada handoff). Aditivo: no toca el comportamiento del
 * chat actual hasta que el loop se parametrice por agente.
 */
export class Migration20260626120000 extends Migration {
  override async up(): Promise<void> {
    // ai_skill: skills reutilizables adjuntables a agentes.
    this.addSql(`
      create table if not exists "ai_skill" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "instructions" text not null,
        "enabled" boolean not null default true,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_skill_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_skill_key_unique" ON "ai_skill" ("key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_skill_deleted_at" ON "ai_skill" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // ai_agent: definición declarativa (manifiesto) de cada agente.
    this.addSql(`
      create table if not exists "ai_agent" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "description" text null,
        "instructions" text not null,
        "model" text null,
        "max_tokens" integer null,
        "reasoning_effort" text check ("reasoning_effort" in ('minimal', 'low', 'medium', 'high')) null,
        "enabled" boolean not null default true,
        "is_orchestrator" boolean not null default false,
        "rank" integer not null default 0,
        "icon" text null,
        "allowed_tools" jsonb null,
        "skills" jsonb null,
        "handoff_targets" jsonb null,
        "source" text check ("source" in ('system', 'custom', 'thirdparty')) not null default 'system',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_agent_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_agent_key_unique" ON "ai_agent" ("key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_deleted_at" ON "ai_agent" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // chat_thread: agente activo del hilo (se actualiza en cada handoff).
    this.addSql(
      `ALTER TABLE "chat_thread" ADD COLUMN IF NOT EXISTS "active_agent_id" text null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "chat_thread" DROP COLUMN IF EXISTS "active_agent_id";`);
    this.addSql(`drop table if exists "ai_agent" cascade;`);
    this.addSql(`drop table if exists "ai_skill" cascade;`);
  }
}
