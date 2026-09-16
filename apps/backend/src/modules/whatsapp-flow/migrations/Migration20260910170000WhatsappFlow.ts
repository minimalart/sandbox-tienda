import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `whatsapp_flow_version` — el grafo de conversación del bot, versionado.
 *
 * Los dos índices únicos son PARCIALES y van a mano porque usan `coalesce` sobre
 * una columna nullable, que `.indexes()` del modelo no sabe expresar. No son un
 * detalle: sin ellos, dos publicaciones concurrentes dejarían dos versiones activas
 * y el bot mezclaría nodos de las dos. Misma solución que
 * `UQ_recommendation_version_active`.
 *
 * El nombre del archivo lleva el módulo en PascalCase a propósito: umzug registra
 * las migraciones por nombre en UNA sola tabla compartida, así que dos homónimas en
 * módulos distintos hacen que la segunda se saltee EN SILENCIO, con `db:migrate`
 * saliendo 0 y el esquema incompleto. Ver `docs/recipes/migraciones-modulos-custom.md`.
 */
export class Migration20260910170000WhatsappFlow extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "whatsapp_flow_version" (
        "id" TEXT NOT NULL,
        "flow_key" TEXT NOT NULL,
        "site_id" TEXT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "version" INTEGER NOT NULL DEFAULT 1,
        "name" TEXT NULL,
        "graph" JSONB NULL,
        "notes" TEXT NULL,
        "published_at" TIMESTAMPTZ NULL,
        "published_by" TEXT NULL,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "whatsapp_flow_version_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_flow_version_key_status" ON "whatsapp_flow_version" ("flow_key", "status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_flow_version_key_site_version" ON "whatsapp_flow_version" ("flow_key", "site_id", "version") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_whatsapp_flow_version_deleted_at" ON "whatsapp_flow_version" ("deleted_at");`,
    );

    // Una sola versión ACTIVA por flujo y tienda.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_flow_version_active"
        ON "whatsapp_flow_version" ("flow_key", coalesce("site_id", ''))
        WHERE "status" = 'active' AND "deleted_at" IS NULL;
    `);
    // Y un solo BORRADOR: dos pestañas del editor sobre el mismo flujo tienen que
    // pelear por la misma fila, no crear dos que después nadie sabe cuál publicar.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_flow_version_draft"
        ON "whatsapp_flow_version" ("flow_key", coalesce("site_id", ''))
        WHERE "status" = 'draft' AND "deleted_at" IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "UQ_whatsapp_flow_version_draft";`);
    this.addSql(`DROP INDEX IF EXISTS "UQ_whatsapp_flow_version_active";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_flow_version_deleted_at";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_flow_version_key_site_version";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_whatsapp_flow_version_key_status";`);
    this.addSql(`DROP TABLE IF EXISTS "whatsapp_flow_version";`);
  }
}
