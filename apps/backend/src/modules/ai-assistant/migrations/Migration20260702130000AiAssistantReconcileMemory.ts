import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Reconciliación idempotente de `Migration20260630120000` (memoria vectorizada:
 * `ai_agent_memory`, `ai_memory_document`, columnas `memory_types` /
 * `injected_memory_ids` y la columna/índice pgvector).
 *
 * Por qué existe: `Migration20260630120000` también existe en `shop-by-look` y
 * `mikro_orm_migrations` registra por NOMBRE global: en una DB fresca shop-by-look
 * migra primero (orden de `medusa-config.ts`) y la homónima de ai-assistant queda
 * salteada EN SILENCIO — sin vector store ni columnas de memoria. (El caso espejo,
 * shop_by_look víctima en prod, ya se reconcilió con `Migration20260630210000`.)
 *
 * Por qué este nombre/orden: corre al final del módulo (después de
 * `Migration20260626120000`/`...160000`, que crean `ai_agent` y `ai_agent_run`, a
 * las que esta migración agrega columnas). La parte de chat/policy de las otras dos
 * colisiones la repara `Migration20260625000000AiAssistantReconcileChat`.
 *
 * pgvector: la original asume la extensión `vector` disponible. Acá se aplica con
 * guarda para no romper el migrate donde no está (Postgres local sin pgvector, o
 * sin permisos de CREATE EXTENSION): las tablas y columnas jsonb se crean igual y
 * `embedding` + índice HNSW quedan pendientes y logueados. Con la extensión ya
 * instalada (prod), todo es no-op.
 *
 * El SELECT inicial audita y loguea qué faltaba: ese log, en el output de
 * `db:migrate` del job predeploy, es la auditoría por entorno.
 */
export class Migration20260702130000AiAssistantReconcileMemory extends Migration {
  override async up(): Promise<void> {
    const [vector] = (await this.execute(`
      select
        exists(select 1 from pg_available_extensions where name = 'vector') as disponible,
        exists(select 1 from pg_extension where extname = 'vector') as instalada
    `)) as Array<{ disponible: boolean; instalada: boolean }>;
    const pendientes = (await this.execute(`
      select 'tabla:ai_agent_memory' as objeto where to_regclass('public.ai_agent_memory') is null
      union all select 'columna:ai_agent_memory.embedding'
        where to_regclass('public.ai_agent_memory') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ai_agent_memory' and column_name = 'embedding'
          )
      union all select 'indice:IDX_ai_agent_memory_tenant_status'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_tenant_status"') is null
      union all select 'indice:IDX_ai_agent_memory_agent_key'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_agent_key"') is null
      union all select 'indice:IDX_ai_agent_memory_type'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_type"') is null
      union all select 'indice:IDX_ai_agent_memory_entity'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_entity"') is null
      union all select 'indice:IDX_ai_agent_memory_source_ref'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_source_ref"') is null
      union all select 'indice:IDX_ai_agent_memory_deleted_at'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_deleted_at"') is null
      union all select 'indice:IDX_ai_agent_memory_embedding_hnsw (requiere pgvector)'
        where to_regclass('public.ai_agent_memory') is not null
          and to_regclass('public."IDX_ai_agent_memory_embedding_hnsw"') is null
      union all select 'tabla:ai_memory_document' where to_regclass('public.ai_memory_document') is null
      union all select 'indice:IDX_ai_memory_document_agent_key'
        where to_regclass('public.ai_memory_document') is not null
          and to_regclass('public."IDX_ai_memory_document_agent_key"') is null
      union all select 'indice:IDX_ai_memory_document_hash'
        where to_regclass('public.ai_memory_document') is not null
          and to_regclass('public."IDX_ai_memory_document_hash"') is null
      union all select 'indice:IDX_ai_memory_document_deleted_at'
        where to_regclass('public.ai_memory_document') is not null
          and to_regclass('public."IDX_ai_memory_document_deleted_at"') is null
      union all select 'columna:ai_agent.memory_types'
        where to_regclass('public.ai_agent') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ai_agent' and column_name = 'memory_types'
          )
      union all select 'columna:ai_agent_run.injected_memory_ids'
        where to_regclass('public.ai_agent_run') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'ai_agent_run' and column_name = 'injected_memory_ids'
          )
    `)) as Array<{ objeto: string }>;
    console.log(
      `[reconcile ai-assistant/memory] pgvector disponible=${vector?.disponible} instalada=${vector?.instalada}; ` +
        (pendientes.length
          ? `a reparar: ${pendientes.map((p) => p.objeto).join(', ')}`
          : 'esquema completo: no-op')
    );

    // Extensión pgvector, con guarda: si no está disponible o no hay permisos, se
    // loguea y se sigue (las partes vectoriales de abajo quedan condicionadas).
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_available_extensions where name = 'vector') then
          begin
            execute 'create extension if not exists vector';
          exception when insufficient_privilege then
            raise warning '[reconcile ai-assistant/memory] pgvector disponible pero sin permisos para CREATE EXTENSION; embedding/hnsw quedan pendientes';
          end;
        else
          raise warning '[reconcile ai-assistant/memory] pgvector no disponible en este Postgres; embedding/hnsw quedan pendientes';
        end if;
      end $$;
    `);

    // --- Contenido de Migration20260630120000 (ai-assistant) ---
    this.addSql(`
      create table if not exists "ai_agent_memory" (
        "id" text not null,
        "tenant_id" text not null default 'default',
        "agent_key" text null,
        "memory_type" text check ("memory_type" in (
          'business_rule','decision','preference','campaign_learning','product_context',
          'customer_segment_context','brand_guideline','operational_policy',
          'conversation_learning','proposal_feedback','document_chunk','faq','system_note'
        )) not null,
        "entity_type" text null,
        "entity_id" text null,
        "title" text not null,
        "content" text not null,
        "summary" text null,
        "embedding_model" text null,
        "embedded_at" timestamptz null,
        "metadata" jsonb null,
        "tags" jsonb null,
        "source" text check ("source" in ('manual','conversation','proposal','document','system')) not null default 'manual',
        "source_ref_id" text null,
        "importance_score" integer not null default 50,
        "confidence_score" integer not null default 70,
        "status" text check ("status" in ('pending','active','archived')) not null default 'active',
        "created_by" text null,
        "last_used_at" timestamptz null,
        "usage_count" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_agent_memory_pkey" primary key ("id")
      );
    `);

    // Columna vectorial + índice HNSW, solo si la extensión quedó instalada. Los
    // EXECUTE difieren el parseo: sin pgvector, el tipo `vector` ni se resuelve.
    this.addSql(`
      do $$
      begin
        if exists (select 1 from pg_extension where extname = 'vector') then
          execute 'alter table "ai_agent_memory" add column if not exists "embedding" vector(1536)';
          execute 'create index if not exists "IDX_ai_agent_memory_embedding_hnsw" on "ai_agent_memory" using hnsw ("embedding" vector_cosine_ops)';
        end if;
      end $$;
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_tenant_status" ON "ai_agent_memory" ("tenant_id", "status") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_agent_key" ON "ai_agent_memory" ("agent_key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_type" ON "ai_agent_memory" ("memory_type") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_entity" ON "ai_agent_memory" ("entity_type", "entity_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_source_ref" ON "ai_agent_memory" ("source_ref_id") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_deleted_at" ON "ai_agent_memory" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    this.addSql(`
      create table if not exists "ai_memory_document" (
        "id" text not null,
        "tenant_id" text not null default 'default',
        "agent_key" text null,
        "title" text not null,
        "original_filename" text null,
        "mime_type" text not null,
        "content" text not null,
        "content_hash" text not null,
        "char_count" integer not null default 0,
        "chunk_count" integer not null default 0,
        "status" text check ("status" in ('processing','ready','failed')) not null default 'processing',
        "error" text null,
        "created_by" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "ai_memory_document_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_memory_document_agent_key" ON "ai_memory_document" ("agent_key") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_memory_document_hash" ON "ai_memory_document" ("tenant_id", "content_hash") WHERE deleted_at IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_memory_document_deleted_at" ON "ai_memory_document" ("deleted_at") WHERE deleted_at IS NULL;`
    );

    // Columnas aditivas en tablas de otras migraciones del módulo (creadas por
    // Migration20260626120000/...160000, que corren antes que esta). `IF EXISTS`
    // de armadura: si faltaran, lo repara su propia migración, no esta.
    this.addSql(
      `alter table if exists "ai_agent" add column if not exists "memory_types" jsonb null;`
    );
    this.addSql(
      `alter table if exists "ai_agent_run" add column if not exists "injected_memory_ids" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    // No-op: la baja de estos objetos la maneja la migración original
    // (Migration20260630120000). Esta solo reconcilia un estado inconsistente.
  }
}
