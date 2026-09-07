import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// Loyalty Engine — Fase 2: entidades de configuración/orquestación del motor.
// El ledger vive en el módulo `points` (extensión loyalty-points); este módulo
// solo configura cómo se ganan/gastan los puntos. Idempotente.
export class Migration20260721130000Loyalty extends Migration {

  override async up(): Promise<void> {
    // ── loyalty_program ──────────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_program" ("id" text not null, "name" text not null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "points_name" text not null default 'puntos', "currency_code" text not null default 'ars', "starts_at" timestamptz null, "ends_at" timestamptz null, "expiration_policy" jsonb null, "config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_program_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_program_deleted_at" ON "loyalty_program" ("deleted_at") WHERE deleted_at IS NULL;`);

    // ── loyalty_earn_rule ────────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_earn_rule" ("id" text not null, "name" text not null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "priority" integer not null default 0, "event" text check ("event" in ('purchase', 'signup', 'first_purchase', 'order_delivered', 'birthday', 'referral')) not null, "calc_type" text check ("calc_type" in ('fixed', 'percentage', 'multiplier')) not null, "calc_value" integer not null default 0, "conditions" jsonb null, "limits" jsonb null, "program_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_earn_rule_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_earn_rule_program_id" ON "loyalty_earn_rule" ("program_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_earn_rule_deleted_at" ON "loyalty_earn_rule" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`do $$ begin alter table "loyalty_earn_rule" add constraint "loyalty_earn_rule_program_id_foreign" foreign key ("program_id") references "loyalty_program" ("id") on update cascade; exception when duplicate_object then null; end $$;`);

    // ── loyalty_reward ───────────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_reward" ("id" text not null, "name" text not null, "description" text null, "image_url" text null, "cost_points" integer not null, "type" text check ("type" in ('fixed_discount', 'percent_discount', 'free_shipping', 'free_product', 'store_credit', 'custom')) not null, "config" jsonb null, "stock" integer null, "valid_from" timestamptz null, "valid_to" timestamptz null, "segments" jsonb null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "program_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_reward_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_program_id" ON "loyalty_reward" ("program_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_deleted_at" ON "loyalty_reward" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`do $$ begin alter table "loyalty_reward" add constraint "loyalty_reward_program_id_foreign" foreign key ("program_id") references "loyalty_program" ("id") on update cascade; exception when duplicate_object then null; end $$;`);

    // ── loyalty_reward_grant ─────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_reward_grant" ("id" text not null, "customer_id" text not null, "status" text check ("status" in ('pending', 'available', 'used', 'expired', 'cancelled')) not null default 'available', "benefit_type" text check ("benefit_type" in ('promotion', 'store_credit')) null, "benefit_ref" text null, "points_spent" integer not null default 0, "ledger_txn_id" text null, "expires_at" timestamptz null, "used_at" timestamptz null, "reward_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_reward_grant_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_grant_reward_id" ON "loyalty_reward_grant" ("reward_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_grant_customer_id" ON "loyalty_reward_grant" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_reward_grant_deleted_at" ON "loyalty_reward_grant" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`do $$ begin alter table "loyalty_reward_grant" add constraint "loyalty_reward_grant_reward_id_foreign" foreign key ("reward_id") references "loyalty_reward" ("id") on update cascade; exception when duplicate_object then null; end $$;`);

    // ── loyalty_tier ─────────────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_tier" ("id" text not null, "name" text not null, "condition_type" text check ("condition_type" in ('spend', 'points', 'orders')) not null default 'spend', "threshold" integer not null default 0, "multiplier" integer not null default 1, "benefits" jsonb null, "program_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_tier_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_tier_program_id" ON "loyalty_tier" ("program_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_tier_deleted_at" ON "loyalty_tier" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`do $$ begin alter table "loyalty_tier" add constraint "loyalty_tier_program_id_foreign" foreign key ("program_id") references "loyalty_program" ("id") on update cascade; exception when duplicate_object then null; end $$;`);

    // ── loyalty_campaign ─────────────────────────────────────────────────────
    this.addSql(`create table if not exists "loyalty_campaign" ("id" text not null, "name" text not null, "status" text check ("status" in ('active', 'inactive')) not null default 'active', "starts_at" timestamptz null, "ends_at" timestamptz null, "multiplier" integer not null default 1, "affected_rule_ids" jsonb null, "limits" jsonb null, "priority" integer not null default 0, "program_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "loyalty_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_campaign_program_id" ON "loyalty_campaign" ("program_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_loyalty_campaign_deleted_at" ON "loyalty_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`do $$ begin alter table "loyalty_campaign" add constraint "loyalty_campaign_program_id_foreign" foreign key ("program_id") references "loyalty_program" ("id") on update cascade; exception when duplicate_object then null; end $$;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "loyalty_earn_rule" drop constraint if exists "loyalty_earn_rule_program_id_foreign";`);
    this.addSql(`alter table if exists "loyalty_reward" drop constraint if exists "loyalty_reward_program_id_foreign";`);
    this.addSql(`alter table if exists "loyalty_reward_grant" drop constraint if exists "loyalty_reward_grant_reward_id_foreign";`);
    this.addSql(`alter table if exists "loyalty_tier" drop constraint if exists "loyalty_tier_program_id_foreign";`);
    this.addSql(`alter table if exists "loyalty_campaign" drop constraint if exists "loyalty_campaign_program_id_foreign";`);
    this.addSql(`drop table if exists "loyalty_campaign" cascade;`);
    this.addSql(`drop table if exists "loyalty_tier" cascade;`);
    this.addSql(`drop table if exists "loyalty_reward_grant" cascade;`);
    this.addSql(`drop table if exists "loyalty_reward" cascade;`);
    this.addSql(`drop table if exists "loyalty_earn_rule" cascade;`);
    this.addSql(`drop table if exists "loyalty_program" cascade;`);
  }

}
