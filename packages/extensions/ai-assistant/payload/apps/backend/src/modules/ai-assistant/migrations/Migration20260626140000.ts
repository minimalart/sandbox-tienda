import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Propuestas accionables (spine del HITL proactivo): un agente analista deja
 * Propuestas que un humano aprueba/rechaza; al aprobar se ejecutan sus
 * `proposed_actions` por el mismo camino gateado por políticas que el chat.
 */
export class Migration20260626140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "ai_proposal" (
        "id" text not null,
        "agent_key" text not null,
        "thread_id" text null,
        "title" text not null,
        "summary" text not null,
        "rationale" text null,
        "proposed_actions" jsonb null,
        "expected_impact" jsonb null,
        "status" text check ("status" in ('draft', 'pending', 'approved', 'rejected', 'executed', 'failed')) not null default 'pending',
        "source" text check ("source" in ('proactive', 'chat')) not null default 'proactive',
        "created_by" text null,
        "reviewed_by" text null,
        "execution_result" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_proposal_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_proposal_status" ON "ai_proposal" ("status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_proposal_deleted_at" ON "ai_proposal" ("deleted_at") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ai_proposal" cascade;`);
  }
}
