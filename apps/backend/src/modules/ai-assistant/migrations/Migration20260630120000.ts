import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Memoria vectorizada (pgvector) del Asistente IA.
 *
 * - Habilita la extensión `vector` (pgvector). En DO Managed Postgres puede requerir
 *   correrla una vez como `doadmin`; con la extensión ya presente, `IF NOT EXISTS`
 *   es un no-op. Verificar con `SELECT * FROM pg_available_extensions WHERE name='vector'`.
 * - Crea `ai_agent_memory` (vector store) y `ai_memory_document` (doc padre para
 *   re-chunk + estado de ingesta).
 * - La columna `embedding vector(1536)` se agrega NULLABLE por SQL crudo: el ORM de
 *   Medusa no conoce el tipo `vector`, así que el modelo `agent-memory.ts` NO la
 *   declara y se lee/escribe por knex. OJO: `db:generate` no entiende esta columna y
 *   sugeriría `DROP COLUMN embedding` — IGNORARLO; nunca pegar un autogenerado ciego.
 * - Índice vectorial HNSW (anda desde 0 filas, sin training; pgvector ≥ 0.5).
 * - Aditivo: agrega `ai_agent.memory_types` (tipos que recupera cada agente) e
 *   `ai_agent_run.injected_memory_ids` (auditoría de qué memoria influyó).
 */
export class Migration20260630120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create extension if not exists vector;`);

    // ai_agent_memory: el vector store. La columna `embedding` se agrega abajo.
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

    // Columna vectorial (NULLABLE: la fila existe entre el INSERT y el UPDATE del
    // embedding; `embedding IS NULL` = pendiente de embeber, lo levanta el job).
    this.addSql(`alter table "ai_agent_memory" add column if not exists "embedding" vector(1536);`);

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
    // Índice vectorial para `embedding <=> $1` (distancia coseno).
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_agent_memory_embedding_hnsw" ON "ai_agent_memory" USING hnsw ("embedding" vector_cosine_ops);`
    );

    // ai_memory_document: documento padre (texto extraído + estado de ingesta).
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

    // Columnas aditivas en tablas existentes.
    this.addSql(`alter table "ai_agent" add column if not exists "memory_types" jsonb null;`);
    this.addSql(
      `alter table "ai_agent_run" add column if not exists "injected_memory_ids" jsonb null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "ai_agent_run" drop column if exists "injected_memory_ids";`);
    this.addSql(`alter table "ai_agent" drop column if exists "memory_types";`);
    this.addSql(`drop table if exists "ai_memory_document" cascade;`);
    this.addSql(`drop table if exists "ai_agent_memory" cascade;`);
    // No se dropea la extensión `vector` (podría usarla otra cosa).
  }
}
