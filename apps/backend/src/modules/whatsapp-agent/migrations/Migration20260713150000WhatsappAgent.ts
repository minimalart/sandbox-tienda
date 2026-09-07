import { Migration } from '@mikro-orm/migrations';

export class Migration20260713150000WhatsappAgent extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "whatsapp_conversation" (
        "id"                  TEXT        NOT NULL,
        "phone"               TEXT        NOT NULL,
        "customer_id"         TEXT,
        "email"               TEXT,
        "country_code"        TEXT,
        "draft_items"         JSONB,
        "messages"            JSONB,
        "last_checkout_token" TEXT,
        "metadata"            JSONB,
        "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"          TIMESTAMPTZ,
        CONSTRAINT "whatsapp_conversation_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_whatsapp_conversation_phone" ON "whatsapp_conversation" ("phone") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_conversation_deleted_at" ON "whatsapp_conversation" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "whatsapp_conversation";`);
  }
}
