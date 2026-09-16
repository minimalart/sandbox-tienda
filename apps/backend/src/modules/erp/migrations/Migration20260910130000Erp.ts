import { Migration } from '@medusajs/framework/mikro-orm/migrations';

/**
 * `erp_outbox_event.request_payload`: el documento TAL CUAL se envió al ERP.
 *
 * El outbox guardaba la INTENCIÓN (`payload`: qué se vendió) y el ACUSE
 * (`response_payload`: qué contestó el ERP), pero no el documento emitido. Y
 * los parámetros que el ERP pide auditar —sucursal, depósito, punto de venta,
 * condición de venta, tipo de comprobante, código de vendedor, medio de pago—
 * no están en `payload`: salen de `erp_config.settings` recién en el momento de
 * enviar. Resultado: ante un "mandanos el JSON del pedido" (pedido real de Zeus
 * vía el cliente, 2026-09-10) sólo se podía reconstruir contra la config de
 * HOY, que puede no ser la que se usó.
 *
 * Nullable y sin default: las filas viejas se quedan en NULL, que es la verdad
 * —de esas ventas no se guardó el documento— y la ruta de vista previa lo dice
 * explícitamente en vez de inventar una reconstrucción disfrazada de original.
 *
 * El nombre lleva el módulo (`...Erp`) porque `mikro_orm_migrations` es UNA
 * tabla global y umzug registra por NOMBRE de archivo sin módulo: dos
 * migraciones homónimas en módulos distintos se saltean EN SILENCIO. Lo hace
 * cumplir `src/modules/migration-names.test.ts`.
 *
 * Idempotente (`IF NOT EXISTS`): se puede correr sobre una base que ya la tenga.
 */
export class Migration20260910130000Erp extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "erp_outbox_event" ADD COLUMN IF NOT EXISTS "request_payload" JSONB;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "erp_outbox_event" DROP COLUMN IF EXISTS "request_payload";`);
  }
}
