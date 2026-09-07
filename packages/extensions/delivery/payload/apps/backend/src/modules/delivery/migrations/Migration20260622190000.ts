import { Migration } from '@mikro-orm/migrations';

/**
 * Y4 — Costo operativo estimado en delivery_execution.
 *
 * Agrega `estimated_cost` para persistir el surcharge resuelto por el motor de
 * reglas (M6) como COSTO OPERATIVO INTERNO de la entrega (costeo/analytics), NO
 * como un cargo al cliente.
 *
 * Las reglas se evalúan en create-delivery-execution (fulfillment.created),
 * DESPUÉS del checkout: el envío ya fue cobrado. Mutar el order/payment con el
 * surcharge sería modificar una orden ya pagada. Por eso vive como métrica de
 * costo, desacoplada del monto cobrado.
 *
 * - estimated_cost: NUMERIC nullable. En la unidad menor de la moneda (mismo
 *   criterio que Quote.amount). Nullable: NULL = sin recargo resuelto.
 *
 * Reversible: down() borra la columna.
 *
 * BACKFILL: NO ejecutado. Las ejecuciones previas quedan con estimated_cost =
 * NULL; el dato vivía hasta ahora en metadata.delivery_decision.surcharge para
 * las que pasaron por reglas, y se sigue persistiendo ahí en paralelo.
 */
export class Migration20260622190000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "delivery_execution" ADD COLUMN IF NOT EXISTS "estimated_cost" NUMERIC NULL;`,
    );
  }

  async down(): Promise<void> {
    this.addSql(
      `ALTER TABLE "delivery_execution" DROP COLUMN IF EXISTS "estimated_cost";`,
    );
  }
}
