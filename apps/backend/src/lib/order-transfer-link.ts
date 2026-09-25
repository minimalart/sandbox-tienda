/**
 * El link con el que se confirma la vinculación de un pedido hecho como invitado.
 *
 * ── DE DÓNDE SALE EL TOKEN, QUE NO ES OBVIO ──────────────────────────────────
 *
 * `requestOrderTransferWorkflow` emite `order.transfer_requested` con
 * `{ id, order_change_id }` y NADA MÁS. El token no viaja en el evento: el
 * workflow lo genera y lo guarda como `details.token` de la acción
 * `TRANSFER_CUSTOMER` del order change que acaba de crear, junto con
 * `details.original_email` (el email de la orden) y, si se pidió, `new_email`.
 *
 * Por eso el emisor del mail tiene que ir a buscarlo. Leer esa forma mal es el
 * modo de fallo silencioso de todo esto: sin token no hay link, y el mail o no
 * sale o sale roto. La extracción vive acá, separada del subscriber, para poder
 * probarla sin levantar Medusa.
 *
 * ── A QUIÉN SE LE MANDA ──────────────────────────────────────────────────────
 *
 * A `original_email`: el email de LA ORDEN, no el de la cuenta que la reclama.
 * Ése es el candado del flujo — quien registre una cuenta con el mail de otra
 * persona puede PEDIR la vinculación, pero la confirmación le llega a la dueña
 * del pedido. Mandarlo al que reclama convertiría el flujo en apropiación de
 * pedidos ajenos con un click.
 */

/** Lo mínimo que hace falta de una acción de order change. */
export type OrderChangeActionForTransfer = {
  action?: string | null;
  details?: Record<string, unknown> | null;
};

export type TransferDetails = {
  token: string;
  /** El email de la orden: el destinatario de la confirmación. */
  original_email: string;
  /** Presente sólo si el pedido de transferencia incluyó cambiar el email. */
  new_email: string | null;
};

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * El token y el destinatario de una solicitud de transferencia, o `null`.
 *
 * Devuelve `null` —en vez de romper— cuando no hay acción de transferencia, o
 * cuando le falta el token o el email: el subscriber no puede hacer nada útil con
 * media solicitud, y lo que corresponde es loguear y salir, no tumbar el bus de
 * eventos por un mail.
 */
export function pickTransferDetails(
  actions: OrderChangeActionForTransfer[] | null | undefined,
): TransferDetails | null {
  for (const action of actions ?? []) {
    // `ChangeActionType.TRANSFER_CUSTOMER`. Se compara por string y no por el
    // enum del core para no arrastrar `@medusajs/utils` a un módulo que existe
    // justamente para poder testearse solo.
    if (action?.action !== 'TRANSFER_CUSTOMER') continue;

    const details = action.details ?? {};
    const token = text(details.token);
    const originalEmail = text(details.original_email);
    if (!token || !originalEmail) continue;

    return { token, original_email: originalEmail, new_email: text(details.new_email) };
  }
  return null;
}

/**
 * El link tal como lo abre la persona.
 *
 * Sin `countryCode`: el proxy del storefront resuelve la región desde el env y la
 * URL visible nunca lo lleva (ver `apps/storefront/src/proxy.ts`). Es el mismo
 * criterio que `buildResetLink`.
 */
export function buildTransferAcceptLink(base: string, orderId: string, token: string): string {
  return `${base.replace(/\/+$/, '')}/order/${encodeURIComponent(orderId)}/transfer/${encodeURIComponent(
    token,
  )}/accept`;
}
