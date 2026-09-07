import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `gift_card_design.site_id` — los diseños de gift card pueden ser por tienda.
 *
 * Es branding: la tarjeta lleva la marca de quien la vende. Los existentes quedan en
 * `NULL` = GLOBAL y siguen disponibles en todas — incluido el `brand-default` que el
 * servicio siembra, sin el cual una tienda se quedaría sin ningún diseño.
 *
 * El índice único de `public_id` se parte en dos parciales: en Postgres `NULL != NULL`,
 * así que uno solo sobre (site_id, public_id) dejaría pasar dos globales homónimos.
 */
export class Migration20260807240000GiftCardDesign extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_design" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_public_id_unique";`);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_design_public_global_unique"
         ON "gift_card_design" ("public_id") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_design_site_public_unique"
         ON "gift_card_design" ("site_id", "public_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`,
    );
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_design_site" ON "gift_card_design" ("site_id");`);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_site";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_site_public_unique";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_public_global_unique";`);
    this.addSql(`ALTER TABLE IF EXISTS "gift_card_design" DROP COLUMN IF EXISTS "site_id";`);
  }
}
