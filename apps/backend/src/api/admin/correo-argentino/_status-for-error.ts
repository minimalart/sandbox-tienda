/**
 * Mapeo de los prefijos de error de `correoGenerateTicketsWorkflow` a status
 * HTTP, para las rutas admin de Correo Argentino.
 *
 * Mismo patrón que `statusForError()` en
 * `admin/andreani/orders/[orderId]/tickets/route.ts:16-33`, pero extraído a su
 * propio archivo porque lo comparten la ruta single (`orders/:id/tickets`) y la
 * bulk (`tickets/bulk`): duplicar la tabla en dos `route.ts` es exactamente
 * cómo se desincroniza el significado de un código entre los dos endpoints.
 *
 * La pregunta que este mapeo tiene que responder NO es "¿qué número queda
 * lindo?" sino **"¿tiene sentido que el operador toque Reintentar?"**:
 *
 *  - `404` → la orden no existe. No hay nada que reintentar.
 *  - `400` → falta o está mal un dato (de la orden, del destinatario o del
 *    payload). Lo arregla una persona; reintentar tal cual devuelve lo mismo.
 *    Acá entra también `CORREO_ORDER_CREATE_REJECTED`: Correo rechazó el alta
 *    con un 4xx, o sea que el problema está en lo que mandamos.
 *  - `503` → Correo caído o timeout. Reintentar SÍ sirve, y es lo único que
 *    hace que el botón tenga sentido.
 *  - `502` → Correo contestó OK pero sin el dato central del envío
 *    (el tracking number). El upstream se portó mal, no nosotros ni el operador.
 *  - `500` → estado inconsistente de NUESTRO lado. Es un bug; que llegue al
 *    operador como 500 es correcto, porque no hay acción que lo arregle.
 *
 * Con todo colapsado a 500 el admin no puede distinguir "faltan datos en la
 * dirección" de "Correo está caído", que es la única pregunta que se hace el
 * operador frente a un lote que falló.
 */

export interface CorreoTicketHttpError {
  status: number;
  code: string;
}

/**
 * Errores por datos faltantes o inválidos: de la orden, de la dirección, de las
 * dimensiones de los productos o del payload que armamos. Todos accionables por
 * una persona, ninguno reintentable tal cual.
 */
const CLIENT_ERROR_CODES: ReadonlySet<string> = new Set([
  'ORDER_NOT_PAID',
  'ORDER_NOT_FULFILLED',
  'ORDER_NOT_CORREO',
  'ORDER_MISSING_ITEMS',
  'ORDER_MISSING_SHIPPING_ADDRESS',
  'CORREO_AGENCY_ID_MISSING',
  'CORREO_MISSING_RECIPIENT_NAME',
  'CORREO_MISSING_RECIPIENT_STREET',
  'CORREO_MISSING_RECIPIENT_CITY',
  'CORREO_INVALID_PROVINCE',
  'CORREO_INVALID_POSTAL_CODE',
  'CORREO_POSTAL_CODE_PROVINCE_MISMATCH',
  'CORREO_MISSING_PRODUCT_DIMENSIONS',
  'CORREO_PARCEL_LIMIT_EXCEEDED',
  'CORREO_ORDER_PAYLOAD_INVALID',
  // Correo rechazó el alta con un 4xx: el payload está mal, lo arregla el
  // operador (o nosotros), no un reintento.
  'CORREO_ORDER_CREATE_REJECTED',
]);

/**
 * Extrae el prefijo (`"CODE: mensaje"` → `"CODE"`) y lo mapea a status HTTP.
 *
 * El mensaje hay que leerlo con `extractErrorMessage()` del módulo: el
 * workflow-engine rehidrata el error como objeto plano y `error.message` no
 * existe.
 *
 * `CORREO_PARCEL_INVALID` y `CORREO_TICKET_STATE_INVALID` NO tienen rama propia:
 * son estados inconsistentes de nuestro lado y caen en el 500 del default, que
 * es donde corresponde. Un prefijo desconocido cae al mismo lugar a propósito —
 * un código que nadie mapeó es un bug nuestro, no un 400 del operador.
 */
export function statusForCorreoTicketError(
  message: string
): CorreoTicketHttpError {
  const code = message.split(':')[0]?.trim() || 'CORREO_ERROR';

  if (code === 'ORDER_NOT_FOUND') {
    return { status: 404, code };
  }
  if (CLIENT_ERROR_CODES.has(code)) {
    return { status: 400, code };
  }
  // Correo caído / timeout: el único caso donde reintentar sirve.
  if (code === 'CORREO_ORDER_CREATE_UNAVAILABLE') {
    return { status: 503, code };
  }
  // Alta aceptada sin tracking number: respuesta inválida del upstream.
  if (code === 'CORREO_TRACKING_NUMBER_MISSING') {
    return { status: 502, code };
  }
  return { status: 500, code };
}
