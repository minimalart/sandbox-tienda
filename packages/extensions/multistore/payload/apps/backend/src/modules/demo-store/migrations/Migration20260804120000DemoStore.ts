import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * La tienda PRINCIPAL pasa a ser una fila real de `demo_store`.
 *
 * 1. `is_main` — booleano plano (NO dentro de `content_config`: POST
 *    /admin/demo-stores/{id} reemplaza ese JSON entero). Todos los guards
 *    preguntan por esta columna.
 * 2. Índice único PARCIAL sobre `is_main`: garantiza a lo sumo una fila principal
 *    viva. Es lo que hace idempotente a `ensureMainStore()` incluso con varias
 *    instancias del backend arrancando en paralelo — la segunda pierde la carrera
 *    contra el índice y su catch la absorbe.
 * 3. `source_type` gana `'native'` — el catálogo de la principal ya es de esta
 *    instancia y no se importa. Se widenea SOLO el check de `demo_store`: en
 *    `demo_import_job` `'native'` sigue siendo ILEGAL a propósito, como segunda
 *    línea de defensa para que una fila principal nunca sea elegible para los
 *    runners de import (ver `Migration20260726100000DemoStore` para el precedente
 *    de recreación del constraint, que sí lo aplicaba a las dos tablas).
 *
 * NO inserta la fila: necesita el container para resolver el
 * `default_sales_channel_id`/`default_region_id` del store, y en SQL crudo habría
 * que hardcodear ids de producción. Eso lo hace `ensureMainStore(container)`.
 *
 * Idempotente en los tres pasos.
 */
export class Migration20260804120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table if exists "demo_store"
        add column if not exists "is_main" boolean not null default false;
    `);

    this.addSql(`
      create unique index if not exists "IDX_demo_store_is_main_unique"
        on "demo_store" ("is_main")
        where "is_main" and "deleted_at" is null;
    `);

    // `ensure-tables.ts` crea `source_type` como TEXT PELADO sin check, mientras
    // que `Migration20260623120000` lo creó con un CHECK inline que Postgres nombró
    // `demo_store_source_type_check`. El DROP ... IF EXISTS tolera las dos formas.
    this.addSql(`
      DO $$
      BEGIN
        ALTER TABLE IF EXISTS "demo_store" DROP CONSTRAINT IF EXISTS "demo_store_source_type_check";
        ALTER TABLE IF EXISTS "demo_store"
          ADD CONSTRAINT "demo_store_source_type_check"
          CHECK ("source_type" IN ('woocommerce', 'vtex', 'shopify', 'sales_channel', 'native'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_demo_store_is_main_unique";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "is_main";`);

    // Volver al set anterior sólo si no quedó ninguna fila 'native'; si quedó, se
    // deja el constraint amplio (el down no debe fallar ni borrar datos).
    this.addSql(`
      DO $$
      DECLARE
        usados INTEGER;
      BEGIN
        SELECT COUNT(*) INTO usados FROM "demo_store" WHERE "source_type" = 'native';
        IF usados = 0 THEN
          ALTER TABLE IF EXISTS "demo_store" DROP CONSTRAINT IF EXISTS "demo_store_source_type_check";
          ALTER TABLE IF EXISTS "demo_store"
            ADD CONSTRAINT "demo_store_source_type_check"
            CHECK ("source_type" IN ('woocommerce', 'vtex', 'shopify', 'sales_channel'));
        END IF;
      EXCEPTION
        WHEN undefined_table THEN NULL;
      END $$;
    `);
  }
}
