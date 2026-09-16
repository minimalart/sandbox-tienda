import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Agrega los toggles por tienda de "Mis puntos" (fidelización) y "Gift Cards"
 * en el área de cuenta del storefront.
 *
 * Las dos nacen en `true`, al revés que `recurring_enabled` y `tinting_enabled`.
 * Esas estrenaron una función que antes no existía, así que `false` era el statu
 * quo. Acá es al revés: las dos secciones hoy están HARDCODEADAS como siempre
 * visibles, así que el `DEFAULT true NOT NULL` es lo que hace que las filas que
 * YA existen —la principal incluida— sigan viéndose igual después del deploy.
 * Postgres rellena las filas existentes con el default en el mismo ALTER, así
 * que no hace falta un backfill aparte (a diferencia del de tintometría).
 *
 * Sólo gatea la vidriera: los módulos de fidelización y gift cards son de la
 * instancia y conservan sus propios switches en app-settings.
 *
 * Idempotente (ADD COLUMN IF NOT EXISTS) para convivir con `ensure-tables.ts`,
 * que crea las mismas columnas en cada arranque.
 */
export class Migration20260914120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "loyalty_enabled" boolean not null default true;`
    );
    this.addSql(
      `alter table if exists "demo_store" add column if not exists "gift_cards_enabled" boolean not null default true;`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "demo_store" drop column if exists "loyalty_enabled";`);
    this.addSql(`alter table if exists "demo_store" drop column if exists "gift_cards_enabled";`);
  }
}
