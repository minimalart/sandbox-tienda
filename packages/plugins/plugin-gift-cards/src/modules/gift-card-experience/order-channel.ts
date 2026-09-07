import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

/**
 * El canal de la orden que originó una entrega de gift card.
 *
 * Lo comparten el envío (`delivery.ts`) y los avisos de vencimiento y saldo
 * (`lifecycle.ts`): las tres cosas son mails que salen a un comprador y tienen que
 * llevar la marca de la tienda que vendió la tarjeta.
 *
 * Se lee por SQL crudo y no por el módulo de órdenes porque esto corre dentro del
 * módulo de gift cards, que no lo declara como dependencia.
 *
 * Un fallo devuelve `null` y el mail sale con la marca global. Es deliberado: la marca
 * nunca puede voltear una entrega ya cobrada.
 */
export async function channelOfOrder(
  container: MedusaContainer,
  orderId: string | null | undefined,
): Promise<string | null> {
  if (!orderId) return null;
  try {
    const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as {
      raw: (
        sql: string,
        bindings?: unknown[],
      ) => Promise<{ rows?: Array<{ sales_channel_id?: string | null }> }>;
    };
    const result = await pg.raw(
      `SELECT "sales_channel_id" FROM "order" WHERE "id" = ? AND "deleted_at" IS NULL LIMIT 1`,
      [orderId],
    );
    return result?.rows?.[0]?.sales_channel_id ?? null;
  } catch {
    return null;
  }
}
