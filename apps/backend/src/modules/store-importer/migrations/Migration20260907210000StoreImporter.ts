import { Migration } from '@medusajs/framework/mikro-orm/migrations';
export class Migration20260907210000StoreImporter extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists catalog_connection (
      id text primary key, destination_id text not null, sales_channel_id text not null,
      name text not null, enabled boolean not null default false, config jsonb not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz null
    );`);
    this.addSql(`create table if not exists catalog_import (
      id text primary key, connection_id text not null, destination_id text not null, sales_channel_id text not null,
      config jsonb not null, status text not null default 'pending', cancel_requested boolean not null default false,
      cursor integer not null default 0, products jsonb null, report jsonb null, result jsonb null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz null,
      constraint catalog_import_status_check check(status in ('pending','running','completed','partial','failed','cancelled'))
    );`);
    this.addSql(
      `create unique index if not exists catalog_import_active on catalog_import(destination_id, connection_id) where deleted_at is null and status in ('pending','running');`
    );
    this.addSql(
      `create index if not exists catalog_connection_destination on catalog_connection(destination_id) where deleted_at is null;`
    );
    this.addSql(`create table if not exists catalog_record (
      id text primary key, identity text not null, connection_id text not null, destination_id text not null,
      external_product_id text not null, product_id text not null,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz null
    );`);
    this.addSql(
      `create unique index if not exists catalog_record_identity_unique on catalog_record(identity) where deleted_at is null;`
    );
  }
  override async down(): Promise<void> {
    this.addSql('drop table if exists catalog_record;');
    this.addSql('drop table if exists catalog_import;');
    this.addSql('drop table if exists catalog_connection;');
  }
}
