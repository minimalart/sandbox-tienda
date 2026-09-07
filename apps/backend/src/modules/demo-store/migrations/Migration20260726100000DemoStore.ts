import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Habilita el origen de catálogo `sales_channel`: una demo puede tomar sus
 * productos de un sales channel que ya existe en esta instancia, en lugar de
 * scrapear una plataforma externa.
 *
 * `source_type` se creó como TEXT con un CHECK inline (ver
 * `Migration20260623120000`), así que Postgres lo nombró
 * `<tabla>_source_type_check`. Para admitir el valor nuevo hay que recrear el
 * constraint en las DOS tablas: `demo_store` y `demo_import_job` (el job copia
 * el `source_type` de la demo, así que si solo se arregla una, el INSERT del job
 * revienta después de haber provisionado el canal).
 *
 * Idempotente: DROP ... IF EXISTS antes de cada ADD, y el ADD va dentro de un
 * bloque que tolera que el constraint ya exista.
 */
export class Migration20260726100000DemoStore extends Migration {
  private readonly values = "'woocommerce', 'vtex', 'shopify', 'sales_channel'";

  private recreate(table: string, values: string): string {
    return `
      DO $$
      BEGIN
        ALTER TABLE IF EXISTS "${table}" DROP CONSTRAINT IF EXISTS "${table}_source_type_check";
        ALTER TABLE IF EXISTS "${table}"
          ADD CONSTRAINT "${table}_source_type_check" CHECK ("source_type" IN (${values}));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$;
    `;
  }

  override async up(): Promise<void> {
    this.addSql(this.recreate('demo_store', this.values));
    this.addSql(this.recreate('demo_import_job', this.values));
  }

  override async down(): Promise<void> {
    // Volver al set original solo es seguro si no quedó ninguna fila usando el
    // valor nuevo; si quedó, se deja el constraint amplio (el down no debe fallar
    // ni borrar datos).
    const original = "'woocommerce', 'vtex', 'shopify'";
    for (const table of ['demo_store', 'demo_import_job']) {
      this.addSql(`
        DO $$
        DECLARE
          usados INTEGER;
        BEGIN
          SELECT COUNT(*) INTO usados FROM "${table}" WHERE "source_type" = 'sales_channel';
          IF usados = 0 THEN
            ALTER TABLE IF EXISTS "${table}" DROP CONSTRAINT IF EXISTS "${table}_source_type_check";
            ALTER TABLE IF EXISTS "${table}"
              ADD CONSTRAINT "${table}_source_type_check" CHECK ("source_type" IN (${original}));
          END IF;
        EXCEPTION
          WHEN undefined_table THEN NULL;
        END $$;
      `);
    }
  }
}
