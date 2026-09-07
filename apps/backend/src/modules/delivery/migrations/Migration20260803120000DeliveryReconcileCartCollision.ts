import { Migration } from '@mikro-orm/migrations';

/**
 * Reconciliación idempotente de la colisión `Migration20260626000000` entre este
 * módulo (vehículo multi-sucursal) y **@medusajs/cart@2.18.0** (columna `data` en
 * `cart_line_item_tax_line` y `cart_shipping_method_tax_line`).
 *
 * Por qué existe: `mikro_orm_migrations` es UNA tabla global y umzug registra cada
 * migración por NOMBRE, sin módulo. Las dos homónimas comparten el nombre, así que
 * el módulo que migra segundo queda salteado EN SILENCIO. A diferencia de las
 * colisiones históricas (todas entre módulos custom), esta es contra el CORE: la
 * del core no se puede renombrar y apareció de golpe al bumpear a 2.18.0.
 *
 * **La víctima cambia según el entorno, y son las dos direcciones:**
 *
 * - **Base existente** (prod, dev de antes del upgrade): la de delivery se aplicó
 *   el 2026-06-26, así que el nombre ya está registrado y la del core queda
 *   salteada → faltan las dos columnas `data`. El modelo de `@medusajs/cart@2.18.0`
 *   las mapea (`data: model.json().nullable()`), así que MikroORM incluye `"data"`
 *   en todo SELECT/INSERT de tax lines → `column "data" does not exist` → **se rompe
 *   el checkout**.
 * - **Base fresca** (dev nuevo, proyecto generado): `cart` migra ANTES que
 *   `delivery` (verificado: `MODULE: cart` aplica `Migration20260626000000` y el
 *   batch de `delivery` ya no la ve), así que la salteada es la NUESTRA → `vehicle`
 *   se queda con la columna escalar `store_location_id` y sin `store_location_ids`
 *   → **se rompe el módulo delivery**.
 *
 * En los dos casos `db:migrate` sale 0: no hay error, sólo esquema incompleto.
 * Por eso esta migración repara **las dos direcciones**, cada una condicionada a lo
 * que falte de verdad.
 *
 * Por qué vive en `delivery`: la colisión existe exactamente cuando existe este
 * módulo. `medusa-config.ts` lo registra vía `optionalModule('delivery','delivery')`,
 * gateado por la presencia de la carpeta — en un proyecto generado sin la extensión
 * no hay homónima, la del core corre normal y esta reconciliación no se instala.
 *
 * Por qué este nombre/orden: `Migration20260626000000` es la ÚLTIMA migración de
 * este módulo, así que no hay ningún `ALTER` duro posterior que pueda abortar el
 * migrate antes de llegar acá. Y como `delivery` migra después de `cart`, cuando
 * esto corre las tablas de cart ya existen en los dos escenarios. El sufijo del
 * módulo garantiza que el nombre no colisione nunca.
 *
 * El SELECT inicial audita y loguea qué faltaba: ese log, en el output de
 * `db:migrate` del job predeploy, es la auditoría por entorno. Con esquema sano,
 * todo es no-op.
 */
export class Migration20260803120000DeliveryReconcileCartCollision extends Migration {
  async up(): Promise<void> {
    const pendientes = (await this.execute(`
      select 'AUSENTE tabla cart_line_item_tax_line (cart no migro todavia)' as objeto
        where to_regclass('public.cart_line_item_tax_line') is null
      union all select 'columna:cart_line_item_tax_line.data'
        where to_regclass('public.cart_line_item_tax_line') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_name = 'cart_line_item_tax_line' and column_name = 'data'
          )
      union all select 'AUSENTE tabla cart_shipping_method_tax_line (cart no migro todavia)'
        where to_regclass('public.cart_shipping_method_tax_line') is null
      union all select 'columna:cart_shipping_method_tax_line.data'
        where to_regclass('public.cart_shipping_method_tax_line') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_name = 'cart_shipping_method_tax_line' and column_name = 'data'
          )
      union all select 'columna:vehicle.store_location_ids'
        where to_regclass('public.vehicle') is not null
          and not exists (
            select 1 from information_schema.columns
            where table_name = 'vehicle' and column_name = 'store_location_ids'
          )
      union all select 'columna VIEJA sin dropear:vehicle.store_location_id'
        where to_regclass('public.vehicle') is not null
          and exists (
            select 1 from information_schema.columns
            where table_name = 'vehicle' and column_name = 'store_location_id'
          )
    `)) as Array<{ objeto: string }>;
    console.log(
      pendientes.length
        ? `[reconcile cart-collision] a reparar: ${pendientes.map((p) => p.objeto).join(', ')}`
        : '[reconcile cart-collision] esquema completo: no-op'
    );

    // --- Lado CORE: contenido de Migration20260626000000 (@medusajs/cart@2.18.0) ---
    this.addSql(
      `alter table if exists "cart_line_item_tax_line" add column if not exists "data" jsonb null;`,
    );
    this.addSql(
      `alter table if exists "cart_shipping_method_tax_line" add column if not exists "data" jsonb null;`,
    );

    // --- Lado NUESTRO: contenido de Migration20260626000000 (delivery) ---
    // El original no es re-ejecutable tal cual: su UPDATE referencia
    // "store_location_id" y la última sentencia dropea esa columna, así que en una
    // segunda pasada el UPDATE explota con "column does not exist". Acá el backfill
    // va dentro de un `do $$` condicionado a que la columna vieja siga estando, que
    // difiere el parseo y lo vuelve idempotente.
    this.addSql(`ALTER TABLE IF EXISTS "vehicle" ADD COLUMN IF NOT EXISTS "store_location_ids" JSONB;`);
    this.addSql(`
      do $$
      begin
        if exists (
          select 1 from information_schema.columns
          where table_name = 'vehicle' and column_name = 'store_location_id'
        ) then
          execute 'UPDATE "vehicle" SET "store_location_ids" = jsonb_build_array("store_location_id") WHERE "store_location_id" IS NOT NULL AND "store_location_ids" IS NULL';
        end if;
      end $$;
    `);
    this.addSql(`DROP INDEX IF EXISTS "IDX_vehicle_store_location";`);
    this.addSql(`ALTER TABLE IF EXISTS "vehicle" DROP COLUMN IF EXISTS "store_location_id";`);
  }

  async down(): Promise<void> {
    // No-op: la baja de cada objeto la maneja su migración original (la de
    // @medusajs/cart para las columnas `data`, la de delivery para `vehicle`).
    // Esta sólo reconcilia un estado inconsistente.
  }
}
