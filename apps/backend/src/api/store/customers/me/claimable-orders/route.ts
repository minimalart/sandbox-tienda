import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  type ClaimableOrder,
  type ClaimableOrderInput,
  selectClaimableOrders,
} from '../../../../../lib/shared/claimable-orders';

/**
 * GET /store/customers/me/claimable-orders — órdenes que son de este cliente
 * pero no están atadas a su cuenta.
 *
 * EL PROBLEMA (DESDEELSUR-61 / BUG-07). Cuando alguien compra como invitado con
 * un email que YA tiene cuenta, Medusa no reutiliza esa cuenta: el
 * `findOrCreateCustomerStep` de `setAddresses` busca (o crea) un customer
 * INVITADO — `has_account: false`, id propio — y la orden queda colgada de ese
 * id. Después, `GET /store/orders` filtra estrictamente por el `customer_id` de
 * la sesión, nunca por email, así que la compra no aparece nunca en "Mis
 * pedidos" por más veces que la persona inicie sesión. En la base de desdeelsur
 * llegaron a estar 4 de 4 órdenes así.
 *
 * El self-heal del carrito (`util/cart-customer-transfer.ts`) no alcanza: repara
 * un carrito VIVO cuando llega un request autenticado, y acá el carrito ya se
 * completó en una sesión anterior. Sobre una orden ya colocada no puede actuar.
 *
 * POR QUÉ ESTE ENDPOINT SÓLO LISTA. Reasignar `order.customer_id` por
 * coincidencia de email sería adjudicar compras sin probar nada: quien registre
 * una cuenta con el email de otra persona se quedaría con su historial de
 * pedidos, con sus direcciones y con sus montos. Medusa ya tiene el camino
 * verificado para esto — `requestOrderTransfer`, que manda la confirmación al
 * email DE LA ORDEN y exige el click — y el storefront ya lo tiene cableado en
 * `lib/data/orders.ts`. Lo único que faltaba era que la persona pudiera
 * ENTERARSE de que la orden existe sin conocer su id de memoria. Eso es lo que
 * responde esta ruta; la adjudicación la sigue haciendo el flujo de Medusa.
 *
 * TRES CANDADOS, y ninguno es cosmético:
 *
 *  1. Sólo se listan órdenes cuyo email coincide EXACTAMENTE con el del customer
 *     autenticado. Es su propio email: no se expone nada que no sea suyo.
 *  2. Sólo se listan las que cuelgan de un customer SIN cuenta (o de ninguno).
 *     Una orden atada a otra cuenta registrada con el mismo email no se ofrece:
 *     ahí no hay un invitado huérfano, hay otra cuenta, y ofrecer su pedido
 *     sería el vector que este endpoint existe para no abrir.
 *  3. Sólo las del sales channel autorizado por la publishable key del visitante.
 *     Una compra que la persona hizo en otra tienda de la plataforma no se
 *     ofrece: `listOrders` filtra por el canal del tenant, así que vincularla la
 *     haría desaparecer del listado igual.
 *
 * Sin sesión responde `{ orders: [] }` con 200 en vez de 401: es una consulta de
 * conveniencia dentro de una página que ya exige login, y falla cerrada (no
 * revela nada). Un 401 acá sólo agregaría ruido al render de la cuenta.
 */

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id ?? null;
  const empty = { orders: [] as ClaimableOrder[] };

  if (!customerId) {
    res.status(200).json(empty);
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: customers } = (await query.graph({
    entity: 'customer',
    fields: ['id', 'email'],
    filters: { id: customerId },
  })) as { data: Array<{ id: string; email?: string | null }> };

  const email = customers?.[0]?.email?.trim().toLowerCase();
  if (!email) {
    res.status(200).json(empty);
    return;
  }

  // Se filtra por email y el resto se descarta en memoria a propósito: un
  // `$ne` sobre `customer_id` que el repositorio no interpretara devolvería
  // TODAS las órdenes, y el modo de fallo de un filtro mal escrito acá es
  // exponer pedidos ajenos. El volumen por email es chico, así que el filtro
  // explícito no cuesta nada y no depende de cómo se traduzca el operador.
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: [
      'id',
      'display_id',
      'email',
      'created_at',
      'total',
      'currency_code',
      'customer_id',
      'sales_channel_id',
      'customer.has_account',
    ],
    filters: { email },
  })) as { data: ClaimableOrderInput[] };

  // Los candados viven en `lib/shared/claimable-orders.ts`, testeados aparte: es
  // la parte de seguridad y su modo de fallo es silencioso.
  res.status(200).json({
    orders: selectClaimableOrders(orders, {
      id: customerId,
      email,
      salesChannelIds: req.publishable_key_context?.sales_channel_ids ?? [],
    }),
  });
}
