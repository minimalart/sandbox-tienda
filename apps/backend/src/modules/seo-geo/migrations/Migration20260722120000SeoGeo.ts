import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Esquema inicial del módulo SEO & GEO (PRD §6/§8/§10/§16). Crea las 6 tablas de
 * auditoría/páginas/enlaces/hallazgos/scores GEO/snapshots de visibilidad. El
 * modelo se inspira en el data model de open-seo (MIT), adaptado a Medusa.
 * Idempotente (`IF NOT EXISTS`) para correrse en entornos parcialmente migrados
 * (ver docs/recipes/migraciones-modulos-custom.md). Nombre `Migration<ts>SeoGeo`
 * según la convención exigida por migration-names.test.ts.
 */
export class Migration20260722120000SeoGeo extends Migration {
  override async up(): Promise<void> {
    // seo_audit
    this.addSql(`
      create table if not exists "seo_audit" (
        "id" text not null,
        "sales_channel_id" text null,
        "base_url" text null,
        "status" text not null default 'queued',
        "current_phase" text null,
        "trigger" text not null default 'manual',
        "created_by" text null,
        "config" jsonb null,
        "pages_crawled" integer not null default 0,
        "pages_total" integer not null default 0,
        "seo_score" real null,
        "ai_visibility_score" real null,
        "ai_visibility_breakdown" jsonb null,
        "findings_summary" jsonb null,
        "error_summary" jsonb null,
        "started_at" timestamptz null,
        "completed_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_audit_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_audit_status" on "seo_audit" ("status") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_audit_sales_channel_id" on "seo_audit" ("sales_channel_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_audit_deleted_at" on "seo_audit" ("deleted_at") where "deleted_at" is null;`
    );

    // seo_audit_page
    this.addSql(`
      create table if not exists "seo_audit_page" (
        "id" text not null,
        "audit_id" text not null,
        "url" text not null,
        "status_code" integer null,
        "fetch_class" text not null default 'ok',
        "response_time_ms" integer null,
        "content_type" text null,
        "canonical_url" text null,
        "canonical_header" text null,
        "robots_meta" text null,
        "x_robots_tag" text null,
        "is_indexable" boolean not null default true,
        "in_sitemap" boolean not null default false,
        "title" text null,
        "meta_description" text null,
        "og_title" text null,
        "og_description" text null,
        "og_image" text null,
        "h1_count" integer not null default 0,
        "h2_count" integer not null default 0,
        "h3_count" integer not null default 0,
        "h4_count" integer not null default 0,
        "h5_count" integer not null default 0,
        "h6_count" integer not null default 0,
        "heading_order" jsonb null,
        "word_count" integer not null default 0,
        "content_hash" text null,
        "images_total" integer not null default 0,
        "images_missing_alt" integer not null default 0,
        "internal_link_count" integer not null default 0,
        "external_link_count" integer not null default 0,
        "has_structured_data" boolean not null default false,
        "structured_data_types" jsonb null,
        "hreflang_tags" jsonb null,
        "crawl_depth" integer not null default 0,
        "page_type" text null,
        "entity_type" text null,
        "entity_id" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_audit_page_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_audit_page_audit_id" on "seo_audit_page" ("audit_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create unique index if not exists "UQ_seo_audit_page_audit_url" on "seo_audit_page" ("audit_id", "url") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_audit_page_content_hash" on "seo_audit_page" ("content_hash") where "deleted_at" is null;`
    );

    // seo_audit_link
    this.addSql(`
      create table if not exists "seo_audit_link" (
        "id" text not null,
        "audit_id" text not null,
        "source_page_id" text not null,
        "target_url" text not null,
        "anchor" text null,
        "is_internal" boolean not null default true,
        "is_nofollow" boolean not null default false,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_audit_link_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_audit_link_audit_id" on "seo_audit_link" ("audit_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_audit_link_source_page_id" on "seo_audit_link" ("source_page_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_audit_link_audit_target" on "seo_audit_link" ("audit_id", "target_url") where "deleted_at" is null;`
    );

    // seo_finding
    this.addSql(`
      create table if not exists "seo_finding" (
        "id" text not null,
        "audit_id" text not null,
        "engine" text not null,
        "type" text not null,
        "severity" text not null default 'warning',
        "entity_type" text not null default 'page',
        "entity_id" text null,
        "page_url" text null,
        "details" jsonb null,
        "status" text not null default 'open',
        "impact" real null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_finding_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_finding_audit_id" on "seo_finding" ("audit_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_finding_audit_engine" on "seo_finding" ("audit_id", "engine") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_finding_audit_severity" on "seo_finding" ("audit_id", "severity") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_finding_entity" on "seo_finding" ("entity_type", "entity_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_finding_status" on "seo_finding" ("status") where "deleted_at" is null;`
    );

    // seo_geo_product_score
    this.addSql(`
      create table if not exists "seo_geo_product_score" (
        "id" text not null,
        "audit_id" text not null,
        "product_id" text not null,
        "score" real not null default 0,
        "comprehension" real not null default 0,
        "coverage" real not null default 0,
        "authority" real not null default 0,
        "comparability" real not null default 0,
        "structured_data" real not null default 0,
        "depth" real not null default 0,
        "has_use_cases" boolean not null default false,
        "has_materials" boolean not null default false,
        "is_comparable" boolean not null default false,
        "has_faq" boolean not null default false,
        "has_benefits" boolean not null default false,
        "has_compatibilities" boolean not null default false,
        "signals" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_geo_product_score_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_geo_product_score_audit_id" on "seo_geo_product_score" ("audit_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create unique index if not exists "UQ_seo_geo_product_score_audit_product" on "seo_geo_product_score" ("audit_id", "product_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_geo_product_score_product_id" on "seo_geo_product_score" ("product_id") where "deleted_at" is null;`
    );

    // seo_ai_visibility_snapshot
    this.addSql(`
      create table if not exists "seo_ai_visibility_snapshot" (
        "id" text not null,
        "audit_id" text not null,
        "sales_channel_id" text null,
        "score" real not null default 0,
        "breakdown" jsonb null,
        "products_total" integer not null default 0,
        "products_sufficient" integer not null default 0,
        "coverage_percent" real not null default 0,
        "captured_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "seo_ai_visibility_snapshot_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_seo_ai_visibility_snapshot_audit_id" on "seo_ai_visibility_snapshot" ("audit_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_ai_visibility_snapshot_sales_channel_id" on "seo_ai_visibility_snapshot" ("sales_channel_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_seo_ai_visibility_snapshot_captured_at" on "seo_ai_visibility_snapshot" ("captured_at") where "deleted_at" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "seo_ai_visibility_snapshot" cascade;`);
    this.addSql(`drop table if exists "seo_geo_product_score" cascade;`);
    this.addSql(`drop table if exists "seo_finding" cascade;`);
    this.addSql(`drop table if exists "seo_audit_link" cascade;`);
    this.addSql(`drop table if exists "seo_audit_page" cascade;`);
    this.addSql(`drop table if exists "seo_audit" cascade;`);
  }
}
