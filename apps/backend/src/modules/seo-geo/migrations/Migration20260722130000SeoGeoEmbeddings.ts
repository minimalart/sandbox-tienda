import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Tabla de embeddings del catálogo para el Simulador IA / RAG (PRD §12). El
 * vector se guarda como jsonb (ranking cosine en memoria; sin pgvector).
 * Idempotente. Nombre con el módulo en PascalCase (convención migration-names).
 */
export class Migration20260722130000SeoGeoEmbeddings extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "seo_geo_product_embedding" (
        "id" text not null,
        "product_id" text not null,
        "product_title" text null,
        "product_handle" text null,
        "model" text not null,
        "dims" integer not null default 0,
        "text_hash" text null,
        "content" text null,
        "embedding" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_geo_product_embedding_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create unique index if not exists "UQ_seo_geo_product_embedding_product" on "seo_geo_product_embedding" ("product_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_geo_product_embedding_model" on "seo_geo_product_embedding" ("model") where "deleted_at" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_geo_product_embedding" cascade;`);
  }
}
