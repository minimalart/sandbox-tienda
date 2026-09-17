import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Idempotent safety net that guarantees the demo-store tables exist.
 *
 * The module ships a MikroORM migration (migrations/Migration20260623120000.ts),
 * but it only takes effect when `medusa db:migrate` runs against the target DB.
 * On environments where the deploy pipeline doesn't apply the new module's
 * migration, the list/create endpoints would 500 with "relation does not exist".
 * This runs the same DDL (CREATE TABLE IF NOT EXISTS …) on first use so the
 * feature works regardless. It is a no-op once the tables are present.
 */
const DDL = `
create table if not exists "demo_store" (
  "id" text not null,
  "name" text not null,
  "slug" text not null,
  "template_code" text not null default 'supermercado',
  "country_code" text not null,
  "currency_code" text not null,
  "locale" text not null default 'es',
  "source_type" text not null,
  "source_url" text not null,
  "source_config" jsonb null,
  "target_count" integer null,
  "sales_channel_id" text null,
  "region_id" text null,
  "stock_location_id" text null,
  "status" text not null default 'draft',
  "theme" jsonb null,
  "content_config" jsonb null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz null,
  constraint "demo_store_pkey" primary key ("id")
);
create unique index if not exists "IDX_demo_store_slug_unique" on "demo_store" ("slug") where deleted_at is null;
create index if not exists "IDX_demo_store_deleted_at" on "demo_store" ("deleted_at") where deleted_at is null;

create table if not exists "demo_import_job" (
  "id" text not null,
  "source_type" text not null,
  "source_url" text not null,
  "target_count" integer null,
  "status" text not null default 'pending',
  "total_products" integer not null default 0,
  "fetched_products" integer not null default 0,
  "imported_products" integer not null default 0,
  "linked_products" integer not null default 0,
  "skipped_products" integer not null default 0,
  "failed_products" integer not null default 0,
  "duration_ms" integer not null default 0,
  "error_log" jsonb null,
  "run_log" jsonb null,
  "started_at" timestamptz null,
  "finished_at" timestamptz null,
  "demo_store_id" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz null,
  constraint "demo_import_job_pkey" primary key ("id")
);
create index if not exists "IDX_demo_import_job_demo_store_id" on "demo_import_job" ("demo_store_id") where deleted_at is null;
create index if not exists "IDX_demo_import_job_deleted_at" on "demo_import_job" ("deleted_at") where deleted_at is null;

alter table if exists "demo_store" add column if not exists "target_count" integer null;
alter table if exists "demo_store" add column if not exists "content_config" jsonb null;
alter table if exists "demo_store" add column if not exists "home_puck_data" jsonb null;
alter table if exists "demo_store" add column if not exists "b2b_enabled" boolean not null default false;
alter table if exists "demo_store" add column if not exists "b2b_pricing_tiers" jsonb null;
alter table if exists "demo_store" add column if not exists "b2b_sales_channel_owned" boolean not null default true;
alter table if exists "demo_store" add column if not exists "b2b_price_list_owned" boolean not null default true;
alter table if exists "demo_store" add column if not exists "b2b_sales_channel_id" text null;
alter table if exists "demo_store" add column if not exists "b2b_customer_group_id" text null;
alter table if exists "demo_store" add column if not exists "b2b_price_list_id" text null;
alter table if exists "demo_store" add column if not exists "b2b_company_id" text null;
alter table if exists "demo_store" add column if not exists "b2b_test_email" text null;
alter table if exists "demo_store" add column if not exists "b2b_test_password" text null;
alter table if exists "demo_store" add column if not exists "recurring_enabled" boolean not null default false;
-- Mi cuenta: "Mis puntos" (fidelización) y "Gift Cards". Van con DEFAULT TRUE, al
-- revés que el resto de los flags: las dos secciones hoy están hardcodeadas como
-- siempre visibles, así que nacer en false se las apagaría a TODAS las tiendas
-- existentes el día del deploy. Postgres rellena las filas que ya existen con el
-- default en el mismo ALTER, así que no necesitan el DO block + backfill que sí
-- necesitó tintometría.
alter table if exists "demo_store" add column if not exists "loyalty_enabled" boolean not null default true;
alter table if exists "demo_store" add column if not exists "gift_cards_enabled" boolean not null default true;
alter table if exists "demo_store" add column if not exists "password_gate_enabled" boolean not null default false;
alter table if exists "demo_store" add column if not exists "password_gate_password" text null;
alter table if exists "demo_store" add column if not exists "is_main" boolean not null default false;
-- Tintometría. La columna se crea DENTRO de un DO block, y no con el ADD COLUMN IF
-- NOT EXISTS de las de arriba, porque necesita un backfill atado a su creación:
-- hasta que el toggle se cableó, la tienda PRINCIPAL mostraba la vidriera con sólo
-- el switch del ERP prendido. Nacer en 'false' le apagaría la página a toda
-- instancia que estrene esta columna en el mismo deploy que el fix. Prender la fila
-- principal preserva exactamente el comportamiento observable: el switch del ERP
-- sigue siendo la segunda llave, así que quien no tenga tintometría no ve nada.
--
-- Sólo corre cuando la columna NO existe, así que nunca pisa una decisión del
-- operador. Las bases que YA la tienen las backfillea Migration20260819120000DemoStore.
-- Va después de "is_main" porque el update lo necesita.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'demo_store' and column_name = 'tinting_enabled'
  ) then
    alter table "demo_store" add column "tinting_enabled" boolean not null default false;
    update "demo_store" set "tinting_enabled" = true where "is_main";
  end if;
end $$;
-- Cuál forma de URL es la canónica para SEO ('host' = subdominio | 'path' = ruta).
-- Las dos resuelven siempre; esto sólo decide cuál indexa Google.
alter table if exists "demo_store" add column if not exists "canonical_form" text not null default 'host';
-- A lo sumo una tienda principal viva. Es lo que hace idempotente a
-- ensureMainStore() con varias instancias arrancando en paralelo.
create unique index if not exists "IDX_demo_store_is_main_unique"
  on "demo_store" ("is_main") where "is_main" and "deleted_at" is null;
-- La fila principal usa source_type 'native'. Este archivo crea source_type como
-- TEXT PELADO (L22), pero Migration20260623120000 lo creó con un CHECK inline que
-- Postgres nombró demo_store_source_type_check SIN 'native'. Las dos formas conviven
-- según cómo nació cada base, y este archivo auto-cura COLUMNAS pero no constraints:
-- en una base creada por migraciones y sin la migración nueva aplicada, el insert de
-- la principal moría con 23514 y ensureMainStore lo degradaba a un warn — o sea,
-- "la tienda principal no aparece en el listado" y nada más.
-- (Ojo: NADA de backticks en este comentario, está dentro de un template literal.)
-- Se ensancha sólo si hace falta: el IF lo vuelve no-op tras la primera vez, así que
-- no hay DROP/ADD (ni su scan de validación) en cada arranque.
do $$ begin
  if exists (
    select 1 from pg_constraint
    where conname = 'demo_store_source_type_check'
      and conrelid = 'demo_store'::regclass
      and pg_get_constraintdef(oid) not like '%native%'
  ) then
    alter table "demo_store" drop constraint "demo_store_source_type_check";
    alter table "demo_store" add constraint "demo_store_source_type_check"
      check ("source_type" in ('woocommerce', 'vtex', 'shopify', 'sales_channel', 'native'));
  end if;
exception
  when undefined_table then null;
end $$;
alter table if exists "demo_import_job" add column if not exists "target_count" integer null;
alter table if exists "demo_import_job" add column if not exists "fetched_products" integer not null default 0;
alter table if exists "demo_import_job" add column if not exists "linked_products" integer not null default 0;
alter table if exists "demo_import_job" add column if not exists "skipped_products" integer not null default 0;
alter table if exists "demo_import_job" add column if not exists "duration_ms" integer not null default 0;
alter table if exists "demo_import_job" add column if not exists "run_log" jsonb null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'demo_import_job_demo_store_id_foreign') then
    alter table "demo_import_job"
      add constraint "demo_import_job_demo_store_id_foreign"
      foreign key ("demo_store_id") references "demo_store" ("id")
      on update cascade on delete cascade;
  end if;
end $$;

-- Module-link tables (demo_store ↔ sales_channel / region / stock_location).
-- Created here too because the Medusa link migrations may not have run on the
-- target DB. Auxiliary: provisioning links into them best-effort.
create table if not exists "demo_store_sales_channel" (
  "id" text not null,
  "demo_store_id" text not null,
  "sales_channel_id" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz null,
  constraint "demo_store_sales_channel_pkey" primary key ("id")
);
create unique index if not exists "IDX_demo_store_sales_channel_pair" on "demo_store_sales_channel" ("demo_store_id", "sales_channel_id") where deleted_at is null;
create index if not exists "IDX_dssc_demo_store_id" on "demo_store_sales_channel" ("demo_store_id");
create index if not exists "IDX_dssc_sales_channel_id" on "demo_store_sales_channel" ("sales_channel_id");

create table if not exists "demo_store_region" (
  "id" text not null,
  "demo_store_id" text not null,
  "region_id" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz null,
  constraint "demo_store_region_pkey" primary key ("id")
);
create unique index if not exists "IDX_demo_store_region_pair" on "demo_store_region" ("demo_store_id", "region_id") where deleted_at is null;
create index if not exists "IDX_dsr_demo_store_id" on "demo_store_region" ("demo_store_id");
create index if not exists "IDX_dsr_region_id" on "demo_store_region" ("region_id");

create table if not exists "demo_store_stock_location" (
  "id" text not null,
  "demo_store_id" text not null,
  "stock_location_id" text not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "deleted_at" timestamptz null,
  constraint "demo_store_stock_location_pkey" primary key ("id")
);
create unique index if not exists "IDX_demo_store_stock_location_pair" on "demo_store_stock_location" ("demo_store_id", "stock_location_id") where deleted_at is null;
create index if not exists "IDX_dssl_demo_store_id" on "demo_store_stock_location" ("demo_store_id");
create index if not exists "IDX_dssl_stock_location_id" on "demo_store_stock_location" ("stock_location_id");

-- site_credential: credenciales de terceros por tienda, cifradas (AES-256-GCM).
-- Tabla propia y no una columna de demo_store: un SELECT de tiendas no debe
-- arrastrar secretos. Espeja Migration20260807120000DemoStore.
create table if not exists site_credential (
  id text not null,
  site_id text not null,
  integration text not null,
  credentials_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint site_credential_pkey primary key (id)
);
create unique index if not exists IDX_site_credential_site_integration on site_credential (site_id, integration) where deleted_at is null;
create index if not exists IDX_site_credential_integration on site_credential (integration) where deleted_at is null;

-- product_sales_mode: modo de venta de un Product dentro de una tienda (PRD
-- Bundles V2 §5). Espeja Migration20260917120000DemoStore. Nace vacía: sin fila,
-- el producto se vende suelto y en bundles, que es lo que ya hacían todos.
create table if not exists product_sales_mode (
  id text not null,
  product_id text not null,
  site_id text not null,
  sales_mode text not null default 'standalone_and_bundle',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint product_sales_mode_pkey primary key (id)
);
create unique index if not exists IDX_product_sales_mode_product_site_unique on product_sales_mode (product_id, site_id) where deleted_at is null;
create index if not exists IDX_product_sales_mode_site_mode on product_sales_mode (site_id, sales_mode) where deleted_at is null;
create index if not exists IDX_product_sales_mode_deleted_at on product_sales_mode (deleted_at) where deleted_at is null;
`;

let ensured: Promise<void> | null = null;

/** Ensure the demo-store tables exist. Runs the DDL at most once per process. */
export function ensureDemoStoreTables(scope: any): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const pg: any = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
      await pg.raw(DDL);
    })().catch((err) => {
      // Allow a retry on the next request if the first attempt failed.
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
