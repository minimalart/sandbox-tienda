import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { recommendationsEnvEnabled } from '../modules/recommendations/config';

/**
 * Anula la atribución de una orden cancelada (PRD §19).
 *
 * Una orden cancelada NO es una compra válida, así que no puede seguir contando como
 * revenue atribuido a recomendaciones. Se sella `voided_at` en lugar de borrar la fila:
 *
 *  - la agregación filtra `voided_at IS NULL`, así que deja de contar de inmediato;
 *  - queda el rastro para auditar (borrarla haría desaparecer la evidencia de que hubo
 *    una compra atribuida que después se canceló).
 *
 * La ventana rodante de la agregación horaria (48h) recalcula los períodos recientes, así
 * que una cancelación de estos días se autocorrige sin intervención.
 *
 * LÍMITE CONOCIDO: los eventos crudos se purgan a los 45 días. Cancelar una orden más
 * vieja que eso ya no puede des-atribuirse — la fila `purchased` ya no existe y la métrica
 * diaria es permanente. Está documentado a propósito: reconciliar más atrás requeriría
 * conservar eventos indefinidamente.
 *
 * El evento es `order.canceled`, con una sola "l" (confirmado contra
 * `order-canceled-loyalty.ts`).
 */
export default async function recommendationOrderCanceled({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const orderId = data?.id;

  if (!orderId || !recommendationsEnvEnabled()) return;

  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as {
      raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
    };

    const result = await knex.raw(
      `update "recommendation_event"
       set voided_at = now(), updated_at = now()
       where order_id = ?
         and event = 'recommendation_purchased'
         and voided_at is null
         and deleted_at is null
       returning id`,
      [orderId],
    );

    const voided = (result?.rows ?? []).length;
    if (voided) {
      logger.info(
        `[recommendations] orden ${orderId} cancelada: ${voided} atribución(es) anulada(s)`,
      );
    }
  } catch (error) {
    logger.error(
      `[recommendations] fallo anular la atribución de la orden ${orderId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.canceled',
};
