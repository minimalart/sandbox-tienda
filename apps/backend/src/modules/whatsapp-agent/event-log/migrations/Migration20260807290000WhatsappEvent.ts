import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `whatsapp_event.site_id` — qué tienda recibió el mensaje.
 *
 * `phone` es el teléfono del CLIENTE, no el eje. El eje es el número de WhatsApp al que
 * escribió, que ya es por tienda desde que las credenciales de Kapso lo son — pero ese
 * dato no viene en el payload que Kapso manda, así que llega por la URL del webhook
 * (`?site=`). Cada tienda apunta su cuenta a la suya.
 *
 * Sin backfill: los eventos anteriores quedan en `NULL` y se siguen viendo desde
 * cualquier tienda. Mientras una cuenta apunte a la URL sin parámetro, sus eventos
 * también — el tablero muestra de más, nunca de menos.
 */
export class Migration20260807290000WhatsappEvent extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_event" ADD COLUMN IF NOT EXISTS "site_id" TEXT NULL;`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_site_created" ON "whatsapp_event" ("site_id", "created_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_event_site_created";`);
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_event" DROP COLUMN IF EXISTS "site_id";`);
  }
}
