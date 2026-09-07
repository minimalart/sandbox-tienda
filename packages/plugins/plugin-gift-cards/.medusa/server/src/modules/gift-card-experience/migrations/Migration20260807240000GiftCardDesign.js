"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migration20260807240000GiftCardDesign = void 0;
const migrations_1 = require("@medusajs/framework/mikro-orm/migrations");
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
class Migration20260807240000GiftCardDesign extends migrations_1.Migration {
    async up() {
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_design" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_public_id_unique";`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_design_public_global_unique"
         ON "gift_card_design" ("public_id") WHERE "site_id" IS NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_gift_card_design_site_public_unique"
         ON "gift_card_design" ("site_id", "public_id") WHERE "site_id" IS NOT NULL AND "deleted_at" IS NULL;`);
        this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gift_card_design_site" ON "gift_card_design" ("site_id");`);
    }
    async down() {
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_site";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_site_public_unique";`);
        this.addSql(`DROP INDEX IF EXISTS "IDX_gift_card_design_public_global_unique";`);
        this.addSql(`ALTER TABLE IF EXISTS "gift_card_design" DROP COLUMN IF EXISTS "site_id";`);
    }
}
exports.Migration20260807240000GiftCardDesign = Migration20260807240000GiftCardDesign;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWlncmF0aW9uMjAyNjA4MDcyNDAwMDBHaWZ0Q2FyZERlc2lnbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dpZnQtY2FyZC1leHBlcmllbmNlL21pZ3JhdGlvbnMvTWlncmF0aW9uMjAyNjA4MDcyNDAwMDBHaWZ0Q2FyZERlc2lnbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5RUFBcUU7QUFFckU7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxxQ0FBc0MsU0FBUSxzQkFBUztJQUN6RCxLQUFLLENBQUMsRUFBRTtRQUNmLElBQUksQ0FBQyxNQUFNLENBQUMsd0ZBQXdGLENBQUMsQ0FBQztRQUN0RyxJQUFJLENBQUMsTUFBTSxDQUFDLCtEQUErRCxDQUFDLENBQUM7UUFDN0UsSUFBSSxDQUFDLE1BQU0sQ0FDVDsrRkFDeUYsQ0FDMUYsQ0FBQztRQUNGLElBQUksQ0FBQyxNQUFNLENBQ1Q7OEdBQ3dHLENBQ3pHLENBQUM7UUFDRixJQUFJLENBQUMsTUFBTSxDQUFDLDJGQUEyRixDQUFDLENBQUM7SUFDM0csQ0FBQztJQUVRLEtBQUssQ0FBQyxJQUFJO1FBQ2pCLElBQUksQ0FBQyxNQUFNLENBQUMsbURBQW1ELENBQUMsQ0FBQztRQUNqRSxJQUFJLENBQUMsTUFBTSxDQUFDLGlFQUFpRSxDQUFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtRUFBbUUsQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxNQUFNLENBQUMsMkVBQTJFLENBQUMsQ0FBQztJQUMzRixDQUFDO0NBQ0Y7QUFyQkQsc0ZBcUJDIn0=