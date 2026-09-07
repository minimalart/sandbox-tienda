import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Estado de la sesión comercial en `whatsapp_conversation.session` (PRD §25).
 *
 * Sin esto el recorrido por botones no puede ser determinístico entre turnos: al
 * tocar "Comprar productos" el bot pide el nombre del producto, pero el mensaje
 * SIGUIENTE es texto libre y sin estado no había forma de saber que ese texto era
 * la búsqueda pedida — se lo mandaba al LLM para que lo adivinara.
 *
 * Una sola columna json (`{ session_id, intent, step, answers, shown_variant_ids }`)
 * porque la forma va a cambiar durante la beta; separarla en columnas obligaría a
 * una migración por cada ajuste del flujo.
 *
 * Idempotente (`ADD COLUMN IF NOT EXISTS`): se puede correr sobre una base que ya
 * la tenga.
 */
export class Migration20260803140000WhatsappAgentSession extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_conversation" ADD COLUMN IF NOT EXISTS "session" JSONB;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_conversation" DROP COLUMN IF EXISTS "session";`);
  }
}
