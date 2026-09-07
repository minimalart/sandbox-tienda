import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Esquema inicial del módulo Catalogador (PRD §24). Crea las 6 tablas de
 * ejecuciones/propuestas/snapshots/actividad. Idempotente (`IF NOT EXISTS`) para
 * poder correrse en entornos parcialmente migrados (ver docs/recipes/
 * migraciones-modulos-custom.md). Nombre `Migration<ts>Catalogador` según la
 * convención exigida por migration-names.test.ts.
 */
export class Migration20260714150000Catalogador extends Migration {
  override async up(): Promise<void> {
    // cataloging_execution
    this.addSql(`
      create table if not exists "cataloging_execution" (
        "id" text not null,
        "name" text not null,
        "status" text not null default 'draft',
        "kind" text not null default 'enrichment',
        "created_by" text null,
        "generation_started_at" timestamptz null,
        "generation_completed_at" timestamptz null,
        "apply_started_at" timestamptz null,
        "applied_at" timestamptz null,
        "cancelled_at" timestamptz null,
        "restored_from_execution_id" text null,
        "duplicated_from_execution_id" text null,
        "configuration_snapshot" jsonb null,
        "selection_definition" jsonb null,
        "selection_count" integer not null default 0,
        "progress" jsonb null,
        "summary" jsonb null,
        "error_summary" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_execution_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_execution_status" on "cataloging_execution" ("status") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_cataloging_execution_created_by" on "cataloging_execution" ("created_by") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_cataloging_execution_deleted_at" on "cataloging_execution" ("deleted_at") where "deleted_at" is null;`
    );

    // cataloging_execution_product
    this.addSql(`
      create table if not exists "cataloging_execution_product" (
        "id" text not null,
        "execution_id" text not null,
        "product_id" text not null,
        "status" text not null default 'pending',
        "product_version_reference" jsonb null,
        "current_snapshot" jsonb null,
        "proposed_changes" jsonb null,
        "accepted_changes" jsonb null,
        "rejected_changes" jsonb null,
        "warnings" jsonb null,
        "errors" jsonb null,
        "external_context_summary" jsonb null,
        "generation_attempts" integer not null default 0,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_execution_product_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_execution_product_execution_id" on "cataloging_execution_product" ("execution_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_cataloging_execution_product_product_id" on "cataloging_execution_product" ("product_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create unique index if not exists "UQ_cataloging_execution_product_exec_prod" on "cataloging_execution_product" ("execution_id", "product_id") where "deleted_at" is null;`
    );

    // cataloging_operation
    this.addSql(`
      create table if not exists "cataloging_operation" (
        "id" text not null,
        "execution_id" text not null,
        "type" text not null,
        "field" text not null,
        "configuration" jsonb null,
        "status" text not null default 'pending',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_operation_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_operation_execution_id" on "cataloging_operation" ("execution_id") where "deleted_at" is null;`
    );

    // cataloging_asset_proposal
    this.addSql(`
      create table if not exists "cataloging_asset_proposal" (
        "id" text not null,
        "execution_product_id" text not null,
        "source_asset_id" text null,
        "generated_asset_id" text null,
        "operation_type" text not null,
        "status" text not null default 'pending',
        "is_ai_generated" boolean not null default false,
        "metadata" jsonb null,
        "generation_provider" text null,
        "generation_model" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_asset_proposal_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_asset_proposal_exec_product_id" on "cataloging_asset_proposal" ("execution_product_id") where "deleted_at" is null;`
    );

    // cataloging_snapshot
    this.addSql(`
      create table if not exists "cataloging_snapshot" (
        "id" text not null,
        "execution_id" text not null,
        "product_id" text not null,
        "type" text not null,
        "data" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_snapshot_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_snapshot_execution_id" on "cataloging_snapshot" ("execution_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_cataloging_snapshot_exec_prod_type" on "cataloging_snapshot" ("execution_id", "product_id", "type") where "deleted_at" is null;`
    );

    // cataloging_activity
    this.addSql(`
      create table if not exists "cataloging_activity" (
        "id" text not null,
        "execution_id" text not null,
        "execution_product_id" text null,
        "actor_id" text null,
        "type" text not null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "cataloging_activity_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_cataloging_activity_execution_id" on "cataloging_activity" ("execution_id") where "deleted_at" is null;`
    );
    this.addSql(
      `create index if not exists "IDX_cataloging_activity_exec_product_id" on "cataloging_activity" ("execution_product_id") where "deleted_at" is null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cataloging_activity" cascade;`);
    this.addSql(`drop table if exists "cataloging_snapshot" cascade;`);
    this.addSql(`drop table if exists "cataloging_asset_proposal" cascade;`);
    this.addSql(`drop table if exists "cataloging_operation" cascade;`);
    this.addSql(`drop table if exists "cataloging_execution_product" cascade;`);
    this.addSql(`drop table if exists "cataloging_execution" cascade;`);
  }
}
