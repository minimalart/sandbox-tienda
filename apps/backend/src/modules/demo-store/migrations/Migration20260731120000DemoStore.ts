import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adds the per-demo "Página de contraseña" (site gate) config. When enabled, the
 * storefront blocks the whole demo until the visitor types the configured word
 * (see api/store/store-config/site-gate + app/[countryCode]/layout.tsx).
 *
 * The password is stored in a flat column — NOT in `content_config` — because
 * POST /admin/demo-stores/{id} replaces that JSON wholesale, so writing it from
 * the Preferencias screen would wipe the demo's sections/contact/texts.
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) so it is safe on DBs where the columns
 * already exist via ensure-tables.
 */
export class Migration20260731120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "password_gate_enabled" boolean not null default false;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "password_gate_password" text null;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" drop column if exists "password_gate_enabled";`
    );
    this.addSql(
      `alter table if exists "demo_store" drop column if exists "password_gate_password";`
    );
  }
}
