import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Esquema inicial del motor de recomendaciones (PRD §11). Crea las 6 tablas:
 * relaciones, estrategias, placements, versiones (que además son el log de
 * corridas), eventos crudos y métricas agregadas.
 *
 * Idempotente (`IF NOT EXISTS`) para poder correrse en entornos parcialmente
 * migrados — ver docs/recipes/migraciones-modulos-custom.md. Nombre
 * `Migration<ts>Recommendations` según la convención que exige
 * `src/modules/migration-names.test.ts`: `mikro_orm_migrations` es una tabla
 * global y umzug registra por nombre de archivo, así que dos migraciones
 * homónimas en módulos distintos se saltean EN SILENCIO.
 *
 * Los índices únicos son PARCIALES (`WHERE deleted_at IS NULL`) para que
 * soft-delete + recreate no choque contra la constraint.
 */
export class Migration20260724120000Recommendations extends Migration {
  override async up(): Promise<void> {
    // -----------------------------------------------------------------------
    // recommendation_relation
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_relation" (
        "id" text not null,
        "source_product_id" text not null,
        "target_product_id" text not null,
        "relation_type" text not null default 'complementary',
        "strategy_key" text not null,
        "origin" text not null default 'merchant',
        "version_id" text null,
        "priority" integer not null default 0,
        "score" real not null default 0,
        "support" real null,
        "confidence" real null,
        "lift" real null,
        "co_occurrences" integer null,
        "is_active" boolean not null default true,
        "valid_from" timestamptz null,
        "valid_until" timestamptz null,
        "sales_channel_id" text null,
        "created_by" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_relation_pkey" primary key ("id")
      );
    `);
    // El índice del serve: cubre todos los predicados de la query de candidatos
    // (estrategia + origen + activa + versión). Es el que sostiene el objetivo de
    // latencia del PRD §18.
    this.addSql(
      `create index if not exists "IDX_recommendation_relation_serve" on "recommendation_relation" ("strategy_key", "source_product_id", "is_active", "version_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create unique index if not exists "UQ_recommendation_relation_manual" on "recommendation_relation" ("source_product_id", "target_product_id", "relation_type") where "deleted_at" is null and "version_id" is null;`,
    );
    this.addSql(
      `create unique index if not exists "UQ_recommendation_relation_versioned" on "recommendation_relation" ("version_id", "source_product_id", "target_product_id") where "deleted_at" is null and "version_id" is not null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_relation_version_id" on "recommendation_relation" ("version_id");`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_relation_target" on "recommendation_relation" ("target_product_id") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_relation_deleted_at" on "recommendation_relation" ("deleted_at");`,
    );

    // -----------------------------------------------------------------------
    // recommendation_strategy
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_strategy" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "kind" text not null,
        "enabled" boolean not null default true,
        "config" jsonb null,
        "fallback_chain" jsonb null,
        "cadence" text not null default 'daily',
        "sales_channel_id" text null,
        "last_built_at" timestamptz null,
        "last_status" text null,
        "sort_order" integer not null default 0,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_strategy_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create unique index if not exists "UQ_recommendation_strategy_key" on "recommendation_strategy" ("key") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_strategy_enabled_kind" on "recommendation_strategy" ("enabled", "kind") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_strategy_deleted_at" on "recommendation_strategy" ("deleted_at");`,
    );

    // -----------------------------------------------------------------------
    // recommendation_placement
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_placement" (
        "id" text not null,
        "key" text not null,
        "name" text not null,
        "enabled" boolean not null default true,
        "strategy_key" text not null,
        "fallback_chain" jsonb null,
        "result_limit" integer not null default 8,
        "candidate_limit" integer not null default 30,
        "filters" jsonb null,
        "relation_types" jsonb null,
        "sales_channel_id" text null,
        "sort_order" integer not null default 0,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_placement_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create unique index if not exists "UQ_recommendation_placement_key" on "recommendation_placement" ("key") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_placement_enabled" on "recommendation_placement" ("enabled") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_placement_deleted_at" on "recommendation_placement" ("deleted_at");`,
    );

    // -----------------------------------------------------------------------
    // recommendation_version
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_version" (
        "id" text not null,
        "strategy_key" text not null,
        "sales_channel_id" text null,
        "status" text not null default 'building',
        "triggered_by" text not null default 'cron',
        "started_at" timestamptz null,
        "finished_at" timestamptz null,
        "activated_at" timestamptz null,
        "duration_ms" integer null,
        "cursor" text null,
        "processed_count" integer not null default 0,
        "events_processed" integer not null default 0,
        "orders_analyzed" integer not null default 0,
        "relations_generated" integer not null default 0,
        "relations_discarded" integer not null default 0,
        "error_summary" jsonb null,
        "config_snapshot" jsonb null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_version_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_recommendation_version_strategy_status" on "recommendation_version" ("strategy_key", "status") where "deleted_at" is null;`,
    );
    // Cola del drainer + reconciliación de corridas colgadas.
    this.addSql(
      `create index if not exists "IDX_recommendation_version_status_updated" on "recommendation_version" ("status", "updated_at");`,
    );
    // "Una sola versión activa por estrategia+canal" como INVARIANTE DE BASE, no
    // como convención del código: el swap corre en una transacción con
    // `for update`, y este índice es lo que impide que dos builds concurrentes
    // dejen dos versiones activas sirviendo relaciones mezcladas. Usa COALESCE
    // sobre una columna nullable, así que no se puede expresar con `.indexes()`
    // del modelo.
    this.addSql(
      `create unique index if not exists "UQ_recommendation_version_active" on "recommendation_version" ("strategy_key", coalesce("sales_channel_id", '')) where "status" = 'active' and "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_version_deleted_at" on "recommendation_version" ("deleted_at");`,
    );

    // -----------------------------------------------------------------------
    // recommendation_event
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_event" (
        "id" text not null,
        "request_id" text not null,
        "event" text not null,
        "placement" text null,
        "strategy_key" text null,
        "resolved_strategy_key" text null,
        "fallback_used" boolean not null default false,
        "version_id" text null,
        "product_id" text null,
        "served_product_ids" jsonb null,
        "position" integer null,
        "source_product_id" text null,
        "cart_id" text null,
        "customer_id" text null,
        "session_id" text null,
        "sales_channel_id" text null,
        "region_id" text null,
        "currency_code" text null,
        "order_id" text null,
        "quantity" integer null,
        "revenue" numeric null,
        "attribution" text null,
        "voided_at" timestamptz null,
        "occurred_at" timestamptz not null default now(),
        "idempotency_key" text not null,
        "aggregated_at" timestamptz null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_event_pkey" primary key ("id")
      );
    `);
    // Verificación de integridad del request_id: una sola lectura indexada trae
    // la fila `served` para todo el lote de eventos.
    this.addSql(
      `create index if not exists "IDX_recommendation_event_request" on "recommendation_event" ("request_id", "event") where "deleted_at" is null;`,
    );
    this.addSql(
      `create unique index if not exists "UQ_recommendation_event_idempotency" on "recommendation_event" ("idempotency_key") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_event_event_occurred" on "recommendation_event" ("event", "occurred_at");`,
    );
    // Timeline de atribución por carrito: es la única query que corre el
    // subscriber de order.placed, y tiene que devolver vacío rápido para la
    // enorme mayoría de órdenes.
    this.addSql(
      `create index if not exists "IDX_recommendation_event_cart" on "recommendation_event" ("cart_id", "event") where "cart_id" is not null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_event_session" on "recommendation_event" ("session_id", "event") where "session_id" is not null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_event_order" on "recommendation_event" ("order_id") where "order_id" is not null;`,
    );
    // Purga por retención (borrado por lotes).
    this.addSql(
      `create index if not exists "IDX_recommendation_event_occurred_at" on "recommendation_event" ("occurred_at");`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_event_deleted_at" on "recommendation_event" ("deleted_at");`,
    );

    // -----------------------------------------------------------------------
    // recommendation_metric
    // -----------------------------------------------------------------------
    this.addSql(`
      create table if not exists "recommendation_metric" (
        "id" text not null,
        "bucket" text not null default 'daily',
        "period_start" timestamptz not null,
        "period_end" timestamptz not null,
        "placement" text null,
        "strategy_key" text null,
        "resolved_strategy_key" text null,
        "sales_channel_id" text null,
        "currency_code" text null,
        "served" integer not null default 0,
        "served_items" integer not null default 0,
        "viewed" integer not null default 0,
        "clicked" integer not null default 0,
        "added_to_cart" integer not null default 0,
        "purchased" integer not null default 0,
        "units_purchased" integer not null default 0,
        "attributed_revenue" numeric not null default 0,
        "assisted_revenue" numeric not null default 0,
        "influenced_orders" integer not null default 0,
        "influenced_order_revenue" numeric not null default 0,
        "aggregated_at" timestamptz not null default now(),
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "recommendation_metric_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `create index if not exists "IDX_recommendation_metric_bucket_period" on "recommendation_metric" ("bucket", "period_start") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_metric_placement" on "recommendation_metric" ("placement", "period_start") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_metric_strategy" on "recommendation_metric" ("strategy_key", "period_start") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_metric_channel" on "recommendation_metric" ("sales_channel_id", "period_start") where "deleted_at" is null;`,
    );
    this.addSql(
      `create index if not exists "IDX_recommendation_metric_deleted_at" on "recommendation_metric" ("deleted_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "recommendation_metric" cascade;`);
    this.addSql(`drop table if exists "recommendation_event" cascade;`);
    this.addSql(`drop table if exists "recommendation_version" cascade;`);
    this.addSql(`drop table if exists "recommendation_placement" cascade;`);
    this.addSql(`drop table if exists "recommendation_strategy" cascade;`);
    this.addSql(`drop table if exists "recommendation_relation" cascade;`);
  }
}
