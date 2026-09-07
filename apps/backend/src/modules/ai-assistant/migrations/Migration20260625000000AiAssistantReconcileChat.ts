import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Reconciliación idempotente de `Migration20260619120000` + `Migration20260622120000`
 * (tablas del chat + política de tools, columna `resource` y su índice único).
 *
 * Por qué existe: `mikro_orm_migrations` es UNA tabla global y umzug registra cada
 * migración por NOMBRE, sin módulo. `Migration20260619120000` también existe en
 * `comments` y `Migration20260622120000` en `delivery`: el módulo que migra primero
 * registra el nombre y la homónima del otro queda salteada EN SILENCIO. En una DB
 * fresca, con el orden de módulos de `medusa-config.ts` (comments y delivery migran
 * antes que ai-assistant), las salteadas son SIEMPRE las de este módulo: quedan sin
 * crearse `chat_thread`, `chat_message` y `ai_tool_policy`.
 *
 * Por qué este nombre/orden: tiene que correr ANTES de `Migration20260626120000` y
 * `Migration20260627130000`, que hacen `ALTER TABLE` duro (sin `IF EXISTS`) sobre
 * `chat_thread`/`chat_message` y abortan el migrate si las tablas no están. El
 * timestamp 20260625000000 lo ubica entre lo que re-aplica (2026-06-19/22) y esos
 * ALTERs; el sufijo del módulo garantiza que el nombre no colisione nunca.
 *
 * Re-aplica el estado final combinado de las dos migraciones originales. No recrea
 * el índice único viejo `IDX_ai_tool_policy_tool_action_unique` porque
 * `Migration20260622120000` lo reemplaza por el de (tool_name, action, resource):
 * recrearlo para dropearlo un statement después sería churn sin sentido.
 *
 * El SELECT inicial audita el esquema y loguea qué faltaba: ese log, en el output
 * de `db:migrate` del job predeploy, es la auditoría por entorno de qué víctima
 * dejó la colisión en cada DB (prod/staging/local). Seguro de re-correr: en un
 * esquema sano todo es no-op.
 */
export class Migration20260625000000AiAssistantReconcileChat extends Migration {
  override async up(): Promise<void> {
    const pendientes = (await this.execute(`
      select 'tabla:chat_thread' as objeto where to_regclass('public.chat_thread') is null
      union all select 'indice:IDX_chat_thread_created_by'
        where to_regclass('public.chat_thread') is not null
          and to_regclass('public."IDX_chat_thread_created_by"') is null
      union all select 'indice:IDX_chat_thread_deleted_at'
        where to_regclass('public.chat_thread') is not null
          and to_regclass('public."IDX_chat_thread_deleted_at"') is null
      union all select 'tabla:chat_message' where to_regclass('public.chat_message') is null
      union all select 'indice:IDX_chat_message_thread_id'
        where to_regclass('public.chat_message') is not null
          and to_regclass('public."IDX_chat_message_thread_id"') is null
      union all select 'indice:IDX_chat_message_deleted_at'
        where to_regclass('public.chat_message') is not null
          and to_regclass('public."IDX_chat_message_deleted_at"') is null
      union all select 'tabla:ai_tool_policy' where to_regclass('public.ai_tool_policy') is null
      union all select 'columna:ai_tool_policy.resource'
        where to_regclass('public.ai_tool_policy') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ai_tool_policy' and column_name = 'resource'
          )
      union all select 'indice:IDX_ai_tool_policy_deleted_at'
        where to_regclass('public.ai_tool_policy') is not null
          and to_regclass('public."IDX_ai_tool_policy_deleted_at"') is null
      union all select 'indice:IDX_ai_tool_policy_tool_action_resource_unique'
        where to_regclass('public.ai_tool_policy') is not null
          and to_regclass('public."IDX_ai_tool_policy_tool_action_resource_unique"') is null
      union all select 'sobrante:indice:IDX_ai_tool_policy_tool_action_unique'
        where to_regclass('public."IDX_ai_tool_policy_tool_action_unique"') is not null
    `)) as Array<{ objeto: string }>;
    console.log(
      pendientes.length
        ? `[reconcile ai-assistant/chat] a reparar: ${pendientes.map((p) => p.objeto).join(', ')}`
        : '[reconcile ai-assistant/chat] esquema completo: no-op'
    );

    // --- Contenido de Migration20260619120000 (ai-assistant) ---
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
      `CREATE INDEX IF NOT EXISTS "IDX_ai_tool_policy_deleted_at" ON "ai_tool_policy" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // --- Contenido de Migration20260622120000 (ai-assistant) ---
    this.addSql(
      `ALTER TABLE "ai_tool_policy" ADD COLUMN IF NOT EXISTS "resource" text NOT NULL DEFAULT '';`
    );
    this.addSql(
      `DROP INDEX IF EXISTS "IDX_ai_tool_policy_tool_action_unique";`
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_tool_policy_tool_action_resource_unique" ON "ai_tool_policy" ("tool_name", "action", "resource") WHERE deleted_at IS NULL;`
    );
  }

  override async down(): Promise<void> {
    // No-op: la baja de estos objetos la manejan las migraciones originales
    // (Migration20260619120000 / Migration20260622120000). Esta solo reconcilia
    // un estado inconsistente.
  }
}
