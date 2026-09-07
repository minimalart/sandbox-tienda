import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * Embudo comercial del asistente de WhatsApp: `whatsapp_event`, una fila por paso
 * (mensaje entrante, búsqueda, productos mostrados, agregado, carrito revisado,
 * checkout generado, derivación…).
 *
 * Antes no se medía NADA del bot: `runWhatsappTurn` no instancia el `RunTracer`
 * del Asistente IA, así que no había ni tokens ni tool calls ni pasos, y menos aún
 * los turnos que se resuelven sin IA — que son justamente los que el PRD pide
 * medir. De ahí la columna `used_ai`.
 *
 * `type` va como TEXT (no enum de Postgres) igual que en `typesense_sync_log`:
 * sumar un evento nuevo no obliga a migrar el tipo.
 *
 * Idempotente (`IF NOT EXISTS`): se puede correr sobre una base que ya la tenga.
 */
export class Migration20260803120000WhatsappEventLog extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "whatsapp_event" (
        "id"         TEXT        NOT NULL,
        "phone"      TEXT        NOT NULL,
        "session_id" TEXT,
        "type"       TEXT        NOT NULL,
        "step"       TEXT,
        "payload"    JSONB,
        "used_ai"    BOOLEAN     NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "whatsapp_event_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_phone_created_at" ON "whatsapp_event" ("phone", "created_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_type_created_at" ON "whatsapp_event" ("type", "created_at");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_session_id" ON "whatsapp_event" ("session_id");`
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_deleted_at" ON "whatsapp_event" ("deleted_at");`
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "whatsapp_event" CASCADE;`);
  }
}
