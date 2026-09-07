import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `site_credential` — credenciales de terceros por tienda, cifradas en reposo.
 *
 * Tabla propia y NO una columna en `demo_store` a propósito: el listado del admin y
 * `GET /admin/multistore/manifest` hacen `SELECT` de tiendas, y un secreto —aunque
 * esté cifrado— no tiene por qué viajar en esas respuestas. Separarlo hace que
 * filtrarlo sea el default y no algo que haya que acordarse de hacer.
 *
 * `credentials_enc` guarda el blob `v1:iv:tag:ct` de `lib/multistore/credentials.ts`
 * (AES-256-GCM, clave derivada de `JWT_SECRET` vía scrypt). El secreto RAÍZ sigue
 * siendo env-only: lo que cambia es que agregar una tienda con cuenta propia de un
 * carrier deja de exigir un redeploy.
 *
 * El UNIQUE es parcial (`WHERE deleted_at IS NULL`) porque el soft-delete de Medusa
 * deja filas: sin el `WHERE`, re-crear una credencial borrada chocaría.
 *
 * Idempotente en los dos sentidos. No lleva FK a `demo_store` a propósito: el módulo
 * puede no estar instalado en un proyecto de cliente, y una FK a una tabla ausente
 * haría fallar la migración entera.
 */
export class Migration20260807120000DemoStore extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "site_credential" (
        "id" TEXT NOT NULL,
        "site_id" TEXT NOT NULL,
        "integration" TEXT NOT NULL,
        "credentials_enc" TEXT NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "site_credential_pkey" PRIMARY KEY ("id")
      );
    `);

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_site_credential_site_integration"
        ON "site_credential" ("site_id", "integration")
        WHERE "deleted_at" IS NULL;
    `);

    // Para resolver "qué tiendas tienen credenciales propias de X" sin escanear.
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "IDX_site_credential_integration"
        ON "site_credential" ("integration")
        WHERE "deleted_at" IS NULL;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_credential_integration";`);
    this.addSql(`DROP INDEX IF EXISTS "IDX_site_credential_site_integration";`);
    this.addSql(`DROP TABLE IF EXISTS "site_credential";`);
  }
}
