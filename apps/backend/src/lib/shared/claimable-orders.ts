/**
 * Qué órdenes se le pueden OFRECER a un cliente para que las vincule a su cuenta.
 *
 * Contexto (DESDEELSUR-61 / BUG-07): comprar como invitado con un email que ya
 * tiene cuenta deja la orden colgada de un customer invitado con id propio, y
 * `GET /store/orders` filtra por `customer_id`, nunca por email — la compra no
 * aparece nunca en "Mis pedidos". El endpoint
 * `GET /store/customers/me/claimable-orders` existe para que la persona pueda
 * enterarse de que esa orden existe; la adjudicación la sigue haciendo el flujo
 * verificado de Medusa (`requestOrderTransfer`, con confirmación al email de la
 * orden).
 *
 * La regla vive acá, separada de la ruta, porque es la parte de SEGURIDAD y el
 * modo de fallo es silencioso: un filtro de más listaría pedidos de otra
 * persona, con sus montos y su historial, sin que nada se rompa ni loguee. Un
 * módulo puro se puede testear sin levantar Medusa.
 */

export type ClaimableOrderInput = {
  id: string;
  display_id?: number | null;
  email?: string | null;
  created_at?: string | Date | null;
  total?: number | null;
  currency_code?: string | null;
  customer_id?: string | null;
  sales_channel_id?: string | null;
  customer?: { has_account?: boolean | null } | null;
};

/** Quién pregunta: el cliente autenticado y los canales que autoriza su tienda. */
export type ClaimingCustomer = {
  id: string;
  email: string | null | undefined;
  /**
   * Canales de la publishable key con la que entró el visitante. Vacío significa
   * "no sé de qué tienda viene", y entonces no se ofrece nada: es el default
   * cerrado.
   */
  salesChannelIds: string[];
};

export type ClaimableOrder = {
  id: string;
  display_id: number | null;
  created_at: string | null;
  total: number | null;
  currency_code: string | null;
};

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
};

/**
 * ¿Esta orden se le puede ofrecer a este cliente, en ESTA tienda?
 *
 * Los cuatro cortes, y por qué cada uno:
 *
 *  1. Ya es suya (`customer_id` coincide) → no se ofrece: aparece por el camino
 *     normal y ofrecer "vincular" algo ya vinculado sólo confunde.
 *  2. El email no es exactamente el suyo → no se ofrece. Es el candado que
 *     impide listar pedidos ajenos, y se re-verifica acá en vez de confiar en
 *     cómo el repositorio tradujo el filtro de la consulta.
 *  3. Cuelga de un customer CON cuenta → no se ofrece. Ahí no hay un invitado
 *     huérfano: hay otra cuenta registrada con el mismo email, y su pedido no es
 *     nuestro para ofrecer. Es el vector de apropiación que este módulo existe
 *     para cerrar.
 *  4. Es de otra tienda de la plataforma → no se ofrece. Aunque la compra sea de
 *     la misma persona, `listOrders` del storefront filtra por el sales channel
 *     del tenant: vincularla la haría desaparecer del listado igual, y mientras
 *     tanto le mostraría a un cliente el pedido que hizo en otra marca.
 *
 * Una orden sin `customer_id` y sin `customer` sí se ofrece: es huérfana, que es
 * el caso que hay que reparar. Una orden sin `sales_channel_id` también, por
 * compatibilidad con las órdenes viejas — el mismo criterio que ya aplica
 * `listOrders`.
 */
export function isClaimableByCustomer(
  order: ClaimableOrderInput,
  customer: ClaimingCustomer,
): boolean {
  const email = normalizeEmail(customer.email);
  if (!customer.id || !email) return false;
  // Sin canales autorizados no se sabe de qué tienda viene el visitante, y
  // ofrecer "todas" sería justo lo contrario de filtrar por tienda.
  if (customer.salesChannelIds.length === 0) return false;

  if (order.customer_id && order.customer_id === customer.id) return false;
  if (normalizeEmail(order.email) !== email) return false;
  if (order.customer?.has_account === true) return false;
  if (
    order.sales_channel_id &&
    !customer.salesChannelIds.includes(order.sales_channel_id)
  ) {
    return false;
  }

  return true;
}

/** Proyección mínima que consume el storefront: nada de items ni direcciones. */
export function toClaimableOrder(order: ClaimableOrderInput): ClaimableOrder {
  return {
    id: order.id,
    display_id: order.display_id ?? null,
    created_at:
      order.created_at instanceof Date
        ? order.created_at.toISOString()
        : (order.created_at ?? null),
    total: order.total ?? null,
    currency_code: order.currency_code ?? null,
  };
}

/** Filtra y proyecta en un paso: es lo que devuelve la ruta. */
export function selectClaimableOrders(
  orders: ClaimableOrderInput[] | null | undefined,
  customer: ClaimingCustomer,
): ClaimableOrder[] {
  return (orders ?? [])
    .filter((order) => isClaimableByCustomer(order, customer))
    .map(toClaimableOrder);
}
