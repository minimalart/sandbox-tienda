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
export declare class Migration20260807240000GiftCardDesign extends Migration {
    up(): Promise<void>;
    down(): Promise<void>;
}
