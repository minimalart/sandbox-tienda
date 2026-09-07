import { Migration } from '@mikro-orm/migrations';

/** Agrega el estado de handoff a humano a whatsapp_conversation (idempotente). */
export class Migration20260714120000WhatsappAgentHandoff extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE IF EXISTS "whatsapp_conversation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'bot';`,
    );
    this.addSql(
      `ALTER TABLE IF EXISTS "whatsapp_conversation" ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMPTZ;`,
    );
    this.addSql(
      `ALTER TABLE IF EXISTS "whatsapp_conversation" ADD COLUMN IF NOT EXISTS "escalation_reason" TEXT;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conversation_status" ON "whatsapp_conversation" ("status") WHERE "deleted_at" IS NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_conversation_status";`);
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_conversation" DROP COLUMN IF EXISTS "escalation_reason";`);
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_conversation" DROP COLUMN IF EXISTS "escalated_at";`);
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_conversation" DROP COLUMN IF EXISTS "status";`);
  }
}
