import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `whatsapp_event.seq` + índice `(session_id, created_at)` — poder reconstruir un
 * recorrido conversacional.
 *
 * Los eventos se emiten fire-and-forget (`void logWaEvent(...)`) y varios de un
 * mismo turno caen en el mismo milisegundo, así que ordenar por `created_at` solo
 * devolvía las decisiones del bot invertidas. `seq` es el orden de EMISIÓN dentro
 * del proceso que atendió el turno; se ordena por `(created_at, seq)`.
 *
 * El índice compuesto es para el timeline de UNA sesión: con el índice suelto de
 * `session_id`, Postgres filtraba y después ordenaba en memoria.
 *
 * Sin backfill: las filas anteriores quedan en `NULL` y ordenan sólo por
 * `created_at`, que es exactamente lo que hacían antes.
 */
export class Migration20260909160000WhatsappEventSeq extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_event" ADD COLUMN IF NOT EXISTS "seq" INTEGER NULL;`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_event_session_created" ON "whatsapp_event" ("session_id", "created_at");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_event_session_created";`);
    this.addSql(`ALTER TABLE IF EXISTS "whatsapp_event" DROP COLUMN IF EXISTS "seq";`);
  }
}
