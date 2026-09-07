"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807260000PaymentBenefits = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
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
class Migration20260807260000PaymentBenefits extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "payment_method_catalog" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_provider_code_external_id_unique";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_method_catalog_global_unique"
         ON "payment_method_catalog" ("provider_code", "external_id")
         WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_payment_method_catalog_site_unique"
         ON "payment_method_catalog" ("site_id", "provider_code", "external_id")
         WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_catalog_site" ON "payment_method_catalog" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_site";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_site_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_payment_method_catalog_global_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "payment_method_catalog" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807260000PaymentBenefits = Migration20260807260000PaymentBenefits;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyNjAwMDBQYXltZW50QmVuZWZpdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9wYXltZW50LWJlbmVmaXRzL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcyNjAwMDBQYXltZW50QmVuZWZpdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseUVBQXFFO0FBRXJFOzs7Ozs7Ozs7R0FTRztBQUNILE1BQWEsc0NBQXVDLFNBQVEsc0JBQVM7SUFDMUQsS0FBSyxDQUFDLEVBQUU7UUFDZixJQUFJLENBQUMsTUFBTSxDQUNULDhGQUE4RixDQUMvRixDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRkFBcUYsQ0FBQyxDQUFDO1FBQ25HLElBQUksQ0FBQyxNQUFNLENBQ1Q7OzJEQUVxRCxDQUN0RCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FDVDs7K0RBRXlELENBQzFELENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUNULHVHQUF1RyxDQUN4RyxDQUFDO0lBQ0osQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMseURBQXlELENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUMsTUFBTSxDQUFDLGdFQUFnRSxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1FBQ2hGLElBQUksQ0FBQyxNQUFNLENBQUMsaUZBQWlGLENBQUMsQ0FBQztJQUNqRyxDQUFDO0NBQ0Y7QUEzQkQsd0ZBMkJDIn0=