import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `payment_method_catalog.site_id` — el catálogo de medios de pago sigue a la cuenta.
 *
 * Desde que las credenciales de MercadoPago son por tienda, dos tiendas con cuentas
 * distintas pueden tener medios habilitados distintos. Mostrar el catálogo de una en la
 * otra le ofrece al comprador un medio que su checkout va a rechazar.
 *
 * Las filas existentes quedan en `NULL` = GLOBAL, el sincronizado con las credenciales
 * de entorno. Sin backfill.
 */
export class Migration20260807260000PaymentBenefits extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "payment_method_catalog" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`,
    );
    this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_provider_code_external_id_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_method_catalog_global_unique"
         ON "payment_method_catalog" ("provider_code", "external_id")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_method_catalog_site_unique"
         ON "payment_method_catalog" ("site_id", "provider_code", "external_id")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_method_catalog_site" ON "payment_method_catalog" ("site_id");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_site_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "payment_method_catalog" DROP COLUMN IF EXISTS "site_id";`);
  }
}
