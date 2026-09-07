import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Catalog sync (productos + listas de precios ERP → Medusa): agrega el flag
 * `catalog_sync_enabled` a `erp_config`.
 *
 * No hace falta tocar `erp_sync_log_item.status` ni `erp_sync_log.type`: ambas
 * son columnas TEXT (ver `Migration20260704120000Erp`), así que los valores
 * nuevos (`created`, `price_unchanged`, `no_price_set`, `variant_not_found`,
 * `not_published`, `catalog_sync`) entran sin migrar ningún tipo.
 *
 * Idempotente: se puede correr sobre una base que ya la tenga.
 */
export class Migration20260724180000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "erp_config" ADD COLUMN IF NOT EXISTS "catalog_sync_enabled" BOOLEAN NOT NULL DEFAULT FALSE;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "erp_config" DROP COLUMN IF EXISTS "catalog_sync_enabled";`);
  }
}
