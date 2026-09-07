import { Migration } from '@mikro-orm/migrations';

/**
 * Reconciliación idempotente de `Migration20260622120000` (tabla
 * `delivery_execution`).
 *
 * Por qué existe: `mikro_orm_migrations` es UNA tabla global y umzug registra cada
 * migración por NOMBRE, sin módulo. `Migration20260622120000` también existe en
 * `ai-assistant`: si ese módulo registró el nombre primero (depende del orden en
 * que migró cada entorno), la homónima de este módulo quedó salteada EN SILENCIO y
 * `delivery_execution` sin crear.
 *
 * Por qué este nombre/orden: tiene que correr ANTES de `Migration20260622140000`,
 * que hace `ALTER TABLE` duro (sin `IF EXISTS`) sobre `delivery_execution` y aborta
 * el migrate si la tabla no está — un entorno víctima quedaría trabado ahí y una
 * reconciliación con fecha posterior nunca llegaría a ejecutarse. El timestamp
 * 20260622121000 la ubica justo después de la original; el sufijo del módulo
 * garantiza que el nombre no colisione nunca.
 *
 * El SELECT inicial audita y loguea qué faltaba: ese log, en el output de
 * `db:migrate` del job predeploy, es la auditoría por entorno. Con esquema sano,
 * todo es no-op.
 */
export class Migration20260622121000DeliveryReconcile extends Migration {
  async up(): Promise<void> {
    const pendientes = (await this.execute(`
      select 'tabla:delivery_execution' as objeto where to_regclass('public.delivery_execution') is null
      union all select 'indice:IDX_delivery_execution_status'
        where to_regclass('public.delivery_execution') is not null
          and to_regclass('public."IDX_delivery_execution_status"') is null
      union all select 'indice:IDX_delivery_execution_provider_type'
        where to_regclass('public.delivery_execution') is not null
          and to_regclass('public."IDX_delivery_execution_provider_type"') is null
      union all select 'indice:IDX_delivery_execution_external_shipment'
        where to_regclass('public.delivery_execution') is not null
          and to_regclass('public."IDX_delivery_execution_external_shipment"') is null
      union all select 'indice:IDX_delivery_execution_deleted_at'
        where to_regclass('public.delivery_execution') is not null
          and to_regclass('public."IDX_delivery_execution_deleted_at"') is null
    `)) as Array<{ objeto: string }>;
    console.log(
      pendientes.length
        ? `[reconcile delivery] a reparar: ${pendientes.map((p) => p.objeto).join(', ')}`
        : '[reconcile delivery] esquema completo: no-op'
    );

    // --- Contenido de Migration20260622120000 (delivery) ---
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "delivery_execution" (
        "id"                   TEXT        NOT NULL,
        "provider_type"        TEXT        NOT NULL,
        "service_mode"         TEXT        NOT NULL,
        "status"               TEXT        NOT NULL DEFAULT 'pending',
        "external_shipment_id" TEXT,
        "tracking_number"      TEXT,
        "label_url"            TEXT,
        "assigned_at"          TIMESTAMPTZ,
        "dispatched_at"        TIMESTAMPTZ,
        "delivered_at"         TIMESTAMPTZ,
        "failed_at"            TIMESTAMPTZ,
        "attempt_count"        INTEGER     NOT NULL DEFAULT 0,
        "scheduled_window"     JSONB,
        "delivery_zone_id"     TEXT,
        "last_event_at"        TIMESTAMPTZ,
        "metadata"             JSONB,
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at"           TIMESTAMPTZ,
        CONSTRAINT "delivery_execution_pkey" PRIMARY KEY ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_status" ON "delivery_execution" ("status") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_provider_type" ON "delivery_execution" ("provider_type") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_external_shipment" ON "delivery_execution" ("external_shipment_id") WHERE "deleted_at" IS NULL;`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_delivery_execution_deleted_at" ON "delivery_execution" ("deleted_at");`,
    );
  }

  async down(): Promise<void> {
    // No-op: la baja de esta tabla la maneja la migración original
    // (Migration20260622120000). Esta solo reconcilia un estado inconsistente.
  }
}
