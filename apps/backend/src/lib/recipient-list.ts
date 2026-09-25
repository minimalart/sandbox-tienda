/**
 * Destinatarios de un mail escritos a mano, separados en casillas.
 *
 * ── POR QUÉ ESTO VIVE EN `lib/` Y NO EN `modules/email/` ─────────────────────
 *
 * Lo necesitan las DOS capas de destinatarios, y son de extensiones distintas:
 * `ADMIN_EMAIL` es de `email-templates` y `admin_notification_email` es de
 * `store-config`. Ponerlo del lado de los mails obligaría a `store-config` a
 * depender de `email-templates`, que ya depende de él: el ciclo que el composer
 * no puede resolver. Acá arriba las dos lo alcanzan sin deberse nada.
 *
 * Y el motivo de fondo para que sea UNA función y no dos: si cada capa partiera
 * la cadena por su cuenta, alcanzaría con que una acepte el punto y coma y la
 * otra no para que el operador vea el aviso salir a una sola casilla, sin ningún
 * error en ningún lado.
 */

/**
 * Una casilla de mail, en la forma laxa que alcanza para NO tirar a la basura lo
 * que el operador tipeó. No valida el dominio ni sigue la RFC: eso lo hace
 * SendGrid al recibir el envío, y ahí el error sí se ve en el log.
 */
const ONE_EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

/**
 * Separa una lista de destinatarios escrita a mano en casillas.
 *
 * Acepta coma, punto y coma y salto de línea porque son las tres formas en que
 * una persona pega una lista, y ninguna es más "correcta" que las otras.
 *
 * Deduplica sin distinguir mayúsculas: `Ventas@x.com` y `ventas@x.com` son la
 * misma casilla y mandar dos veces el mismo aviso al mismo buzón se lee como un
 * bug del sistema, no como una config repetida.
 *
 * Lo que no parece un mail se DESCARTA en silencio en vez de abortar la lista:
 * este parser corre en el camino de envío, y un dedo pegado en la config no
 * puede dejar a las otras tres casillas sin el aviso de un pedido nuevo. La
 * validación con mensaje visible está aguas arriba, en el `pattern` del
 * descriptor y en el zod de la ruta de branding, que es donde el operador está
 * mirando la pantalla.
 */
export function parseRecipientList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(/[,;\r\n]+/)) {
    const candidate = raw.trim();
    if (!candidate || !ONE_EMAIL.test(candidate)) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

/** Cómo se guarda y se loguea una lista de destinatarios: `a@x.com, b@y.com`. */
export function joinRecipientList(recipients: string[]): string {
  return recipients.join(', ');
}

/**
 * Los pedazos de `value` que NO son un mail. Lista vacía = todo válido.
 *
 * Es el complemento de `parseRecipientList`, y existe porque los dos lados tienen
 * que ser el MISMO criterio: el parser descarta en silencio lo que no reconoce
 * —está en el camino de envío y no puede abortar un aviso—, así que sin esto una
 * dirección mal tipeada se guardaría sin una sola queja y el operador vería salir
 * el mail a tres casillas de las cuatro que cargó. Acá, parado frente a la
 * pantalla, el error se muestra.
 *
 * Devuelve los pedazos y no un booleano para poder nombrar CUÁL está mal: con
 * cuatro direcciones en un campo, "hay un email inválido" no alcanza para
 * encontrarlo.
 */
export function invalidRecipients(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !ONE_EMAIL.test(part));
}
