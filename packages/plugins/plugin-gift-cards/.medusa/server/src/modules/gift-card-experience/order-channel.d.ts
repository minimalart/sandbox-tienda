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
export declare function channelOfOrder(container: MedusaContainer, orderId: string | null | undefined): Promise<string | null>;
