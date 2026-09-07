import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Adjuntos en los mensajes del chat: columna `attachments` (jsonb) en `chat_message`.
 * Guarda `ChatAttachment[]` en filas `user` (imágenes para visión + documentos con
 * su texto extraído). Nullable: los mensajes existentes quedan sin adjuntos.
 */
export class Migration20260630180000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "chat_message" add column if not exists "attachments" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "chat_message" drop column if exists "attachments";`);
  }
}
