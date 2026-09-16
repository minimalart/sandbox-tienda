import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * VARIOS BORRADORES POR TIENDA.
 *
 * `UQ_whatsapp_flow_version_draft` dejaba UN borrador por flujo y tienda. Era
 * correcto mientras el editor tenía un solo recorrido —el borrador era "lo que estoy
 * editando"—, pero convertía en imposible lo que se necesita ahora: tener dos o tres
 * recorridos armados y elegir cuál se publica. Con el índice, empezar uno nuevo
 * pisaba el anterior.
 *
 * **El otro índice se queda.** `UQ_whatsapp_flow_version_active` es el que garantiza
 * que UNA sola versión atienda a los clientes de una tienda, y esa sigue siendo la
 * regla: varios borradores, uno publicado. Sin él, dos publicaciones simultáneas
 * dejarían dos activas y el bot mezclaría nodos de las dos.
 *
 * No hay que migrar datos: quitar una restricción no invalida ninguna fila. Y la
 * vuelta atrás puede fallar legítimamente —si ya hay dos borradores, el índice no se
 * puede recrear—, así que `down` no lo intenta a ciegas.
 *
 * El nombre lleva el módulo en PascalCase porque umzug registra las migraciones por
 * nombre en UNA tabla compartida: dos homónimas en módulos distintos hacen que la
 * segunda se saltee en silencio. Ver `docs/recipes/migraciones-modulos-custom.md`.
 */
export class Migration20260916120000WhatsappFlowDrafts extends Migration {
  override async up(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "UQ_whatsapp_flow_version_draft";`);

    /**
     * El listado del ABM pide los borradores de una tienda en cada carga. Sin este
     * índice era un scan sobre todas las versiones de todas las tiendas — que hasta
     * acá era barato porque había una sola fila en borrador, y deja de serlo justo
     * por lo que habilita esta migración.
     */
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_whatsapp_flow_version_key_site_status"
        ON "whatsapp_flow_version" ("flow_key", "site_id", "status")
        WHERE "deleted_at" IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_flow_version_key_site_status";`);
    /**
     * Recrear el índice único sólo si los datos lo permiten. Con dos borradores de
     * la misma tienda —que es el estado normal después de esta migración— el
     * `CREATE UNIQUE INDEX` falla y se llevaría puesto el rollback entero.
     */
    this.addSql(`
      DO $$
      BEGIN
        CREATE UNIQUE INDEX "UQ_whatsapp_flow_version_draft"
          ON "whatsapp_flow_version" ("flow_key", (coalesce("site_id", '')))
          WHERE "status" = 'draft' AND "deleted_at" IS NULL;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Hay mas de un borrador por tienda: el indice unico no se recrea.';
      END $$;
    `);
  }
}
