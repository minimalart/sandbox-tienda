/**
 * Qué hacer cuando el ERP contesta un CONFLICTO (en Zeus, HTTP 409) al insertar
 * una venta.
 *
 * El problema que resuelve: "conflicto" y "duplicado" no son lo mismo. Zeus usa
 * el mismo 409 para "este pedido ya lo tengo" y para "este pedido lo rechazo
 * porque algún dato no me cierra". Tratar los dos como duplicado archiva un
 * rechazo como venta resuelta, y nadie se entera: en desdeelsur, 20 de 22
 * ventas figuraban resueltas sin un solo `idtransac` (DESDEELSUR-61).
 *
 * El discriminador NO es el texto de la respuesta —que no está documentado y
 * cambia— sino una verdad del lado nuestro: **"duplicado" es una afirmación
 * sobre algo que ya mandamos**. Si es el primer envío de esa venta, el ERP no
 * puede tenerla, y el conflicto sólo puede ser un rechazo.
 *
 * Vive separado de `process-outbox.ts` porque ahí adentro no se puede testear
 * sin montar el contenedor entero, y esta decisión es justo la que no puede
 * fallar en silencio. Mismo criterio que `resync-decision.ts` y `backoff.ts`.
 */

export type SaleConflictDecision =
  /** Creíble: ya hubo un envío previo, el ERP puede tenerla de verdad. */
  | { kind: 'duplicate' }
  /** No puede ser duplicado: nunca se mandó. Es un rechazo con otro nombre. */
  | { kind: 'rejected'; message: string };

/** Se recorta el cuerpo del ERP: va a un mensaje de error, no a un log de debug. */
const MAX_REASON = 300;

export function decideSaleConflict(
  attempts: number | null | undefined,
  conflictBody: string | null | undefined
): SaleConflictDecision {
  // `attempts` cuenta los intentos que FALLARON antes de éste. Con al menos uno,
  // hubo un POST previo cuyo resultado no pudimos confirmar (timeout, corte),
  // así que "ya lo tengo" es perfectamente posible: se respeta la idempotencia.
  if ((attempts ?? 0) > 0) return { kind: 'duplicate' };

  const reason = (conflictBody ?? '').trim();
  return {
    kind: 'rejected',
    message:
      'El ERP rechazó la venta con un conflicto en el PRIMER envío, así que no ' +
      'puede ser un duplicado: nunca se había mandado. ' +
      (reason
        ? `Motivo del ERP: ${reason.slice(0, MAX_REASON)}`
        : 'El ERP no devolvió ningún motivo en el cuerpo de la respuesta.'),
  };
}
