import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Atribución por agente en el chat: guarda en cada fila `assistant` la `key` del
 * agente que produjo el mensaje, para mostrar su avatar/nombre al recargar el
 * hilo (en vivo ya se sabe por los eventos del stream). Null en filas viejas o
 * de un solo agente.
 */
export class Migration20260627130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "chat_message" add column if not exists "agent_key" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "chat_message" drop column if exists "agent_key";`);
  }
}
