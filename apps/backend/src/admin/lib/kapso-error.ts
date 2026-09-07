/**
 * Mapea errores CONOCIDOS de Kapso/Meta (que llegan como texto crudo en inglés
 * desde la API, ver `kapsoErrorMessage` en el módulo backend) a una clave i18n
 * con una explicación clara y accionable. Devuelve `null` si el error no es uno
 * conocido — en ese caso se muestra el mensaje crudo como detalle técnico.
 *
 * Agregar acá nuevos casos a medida que aparezcan (un `match` por firma).
 */
const KNOWN_KAPSO_ERRORS: Array<{ match: RegExp; key: string }> = [
  // Número sandbox: Meta solo permite endpoints de mensajería, no gestión de
  // plantillas ("Sandbox WhatsApp configurations only support messaging endpoints").
  { match: /sandbox/i, key: 'ERROR_SANDBOX' },
];

/** Clave i18n para un error conocido de Kapso, o `null` si no se reconoce. */
export function kapsoErrorKey(raw?: string | null): string | null {
  if (!raw) return null;
  return KNOWN_KAPSO_ERRORS.find((e) => e.match.test(raw))?.key ?? null;
}
