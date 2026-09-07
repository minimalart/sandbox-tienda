import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `erp_invoice`: el comprobante que el ERP emite por una orden.
 *
 * Hace falta una tabla y no un campo en `erp_outbox_event` porque el
 * comprobante NO llega con la respuesta de la venta: el ERP factura de forma
 * asincrónica y el dato se recupera después, por poll. Además tiene su propio
 * ciclo de vida (el PDF puede llegar en un segundo intento aunque los datos
 * fiscales ya estén) y se consulta por orden, tanto desde el admin como desde
 * "Mi cuenta".
 *
 * El nombre lleva el módulo (`...Erp`) porque `mikro_orm_migrations` es UNA
 * tabla global y umzug registra por NOMBRE de archivo sin módulo: dos
 * migraciones homónimas en módulos distintos se saltean EN SILENCIO. Lo hace
 * cumplir `src/modules/migration-names.test.ts`.
 *
 * Idempotente (`IF NOT EXISTS` en todo): se puede correr sobre una base que ya
 * la tenga.
 */
export class Migration20260820160000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "erp_invoice" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "order_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "external_ref" TEXT NOT NULL,
        "sucursal" INTEGER NULL,
        "numero_comp" INTEGER NULL,
        "tipo_comp" TEXT NULL,
        "letra" TEXT NULL,
        "punto_de_venta" INTEGER NULL,
        "fecha" TEXT NULL,
        "total" NUMERIC NULL,
        "file_id" TEXT NULL,
        "file_url" TEXT NULL,
        "raw" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL
      );
    `);
    // Un comprobante por orden y provider. Con `WHERE deleted_at IS NULL` para
    // que el soft delete de MedusaService no bloquee re-crear la misma fila.
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_erp_invoice_provider_order_unique"
         ON "erp_invoice" ("provider", "order_id") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_invoice_order_id"
         ON "erp_invoice" ("order_id") WHERE "deleted_at" IS NULL;`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_erp_invoice_external_ref"
         ON "erp_invoice" ("external_ref") WHERE "deleted_at" IS NULL;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "erp_invoice";`);
  }
}
