/**
 * Plantillas de WhatsApp predefinidas (contenido + categoría) que la extensión
 * ofrece "listas para crear" en Kapso, análogo a los templates seedeados de email.
 *
 * Son solo DEFINICIONES locales: se muestran siempre en el admin, pero el template
 * recién existe en Kapso cuando se lo crea (botón "Crear en Kapso" → API de Meta).
 * El `body`/`example` deben coincidir con el nombre y el orden de variables que
 * usa el mapeo por defecto (ver kapso-whatsapp/templates/index.ts).
 */

export type SuggestedTemplate = {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  body: string;
  /** Ejemplos por placeholder ({{1}}, {{2}}…), en orden — requeridos por Meta. */
  example: string[];
  /** Evento sugerido al que corresponde (para orientar la asignación). */
  eventKey: string;
  /** Clave i18n (namespace `whatsapp`) del label del evento sugerido. */
  eventLabelKey: string;
};

export const WHATSAPP_SUGGESTED_TEMPLATES: SuggestedTemplate[] = [
  {
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'es',
    body: '¡Hola {{1}}! 🎉 Gracias por tu compra en Mercatto. Confirmamos tu pedido *#{{2}}* por un total de ${{3}}. Te avisamos por acá apenas lo despachemos. 🛍️',
    example: ['Micaela Gómez', '10428', '24.990,00'],
    eventKey: 'order-confirmation',
    eventLabelKey: 'EVENT_ORDER_CONFIRMATION',
  },
  {
    name: 'order_tracking',
    category: 'UTILITY',
    language: 'es',
    body: '¡Hola {{1}}! 📦 Tu pedido *#{{2}}* de Mercatto ya viaja con Andreani. Seguí tu envío con el código *{{3}}* acá: {{4}} ¡Gracias por tu compra! 🛍️',
    example: [
      'Micaela Gómez',
      '10428',
      'AR0123456789',
      'https://www.andreani.com/seguimiento?codigo=AR0123456789',
    ],
    eventKey: 'order-tracking',
    eventLabelKey: 'EVENT_ORDER_TRACKING',
  },
  {
    name: 'order_delivery_own_fleet',
    category: 'UTILITY',
    language: 'es',
    body: '¡Hola {{1}}! 🚚 Tu pedido *#{{2}}* de Mercatto ya salió para tu domicilio. Lo lleva *{{3}}* en {{4}}. Ante cualquier novedad podés escribirle al {{5}}. ¡Gracias por tu compra! 🛍️',
    example: ['Micaela Gómez', '10428', 'Juan Pérez', 'moto', '+54 9 11 5555-1234'],
    eventKey: 'order-delivery',
    eventLabelKey: 'EVENT_ORDER_DELIVERY',
  },
  {
    name: 'order_cancelled',
    category: 'UTILITY',
    language: 'es',
    body: 'Hola {{1}}, tu pedido *#{{2}}* en Mercatto fue cancelado. Si no fuiste vos o tenés alguna duda, respondé este mensaje y te ayudamos. 🙏',
    example: ['Micaela Gómez', '10428'],
    eventKey: 'order-cancelled',
    eventLabelKey: 'EVENT_ORDER_CANCELLED',
  },
  {
    name: 'password_reset',
    category: 'UTILITY',
    language: 'es',
    body: 'Hola {{1}}, recibimos un pedido para restablecer tu contraseña de Mercatto. Creá una nueva desde acá: {{2}} — es un enlace de un solo uso. Si no fuiste vos, ignorá este mensaje.',
    example: ['Micaela Gómez', 'https://mercatto.com/reset-password?token=a1b2c3d4'],
    eventKey: 'password-reset',
    eventLabelKey: 'EVENT_PASSWORD_RESET',
  },
];
