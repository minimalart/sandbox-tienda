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
    name: 'order_ready_for_pickup',
    category: 'UTILITY',
    language: 'es',
    body: '¡Hola {{1}}! 👋 Tu pedido *#{{2}}* de Mercatto ya está listo para retirar en *{{3}}*. Podés acercarte a {{4}} para retirarlo. ¡Te esperamos! 🛍️',
    example: ['Micaela Gómez', '10428', 'Elordi', 'Eduardo Elordi 1143'],
    eventKey: 'order-ready-for-pickup',
    eventLabelKey: 'EVENT_ORDER_READY_FOR_PICKUP',
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
    // MARKETING, no UTILITY: Meta clasifica así todo lo que empuja a comprar, y
    // mandarla como UTILITY es motivo de rechazo (o de baja de calidad del número).
    //
    // OJO — 2 variables, y el builder de código manda 3 (nombre, total, link, ver
    // kapso-whatsapp/templates/index.ts). Los dos números tienen que coincidir o
    // Meta rechaza el envío entero. Con el binding PUBLICADO desde el admin manda
    // `binding.params` y esto no aplica; con el binding en borrador —que es el
    // default del toggle "Publicar"— corre el fallback de 3 y el mensaje se cae.
    // El test `whatsapp-suggested-templates.test.ts` lo tiene declarado como la
    // única excepción de paridad, con este motivo.
    name: 'cart_abandoned_1',
    category: 'MARKETING',
    language: 'es',
    body: '¡Hola {{1}}! 👋 Vimos que dejaste algunos productos en tu carrito de Mercatto.\nSi querés, podés retomar tu compra desde acá: {{2}}\n¡Tus productos te están esperando! 🛒',
    example: ['Micaela Gómez', 'https://mercatto.com/cart?recover=a1b2c3d4'],
    eventKey: 'cart-abandoned-1',
    eventLabelKey: 'EVENT_CART_ABANDONED_1',
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
