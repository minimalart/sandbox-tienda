export type Ga4EventCategory = 'recomendados' | 'b2b';

export type SupportedEvent = {
  /** Nombre técnico del evento de Medusa (lo que escucha el subscriber genérico). */
  medusa_event: string;
  /** Categoría para agrupar en la UI. */
  category: Ga4EventCategory;
  /** Nombre de evento GA4 sugerido (pre-rellena el formulario). */
  suggested_ga4: string;
  /** Parámetros GA4 sugeridos (hints para el editor avanzado). */
  params: string[];
};

/**
 * Orden de categorías para la UI. "Recomendados" va primero.
 * Las etiquetas visibles se resuelven vía i18n (translations/ga4-events).
 */
export const GA4_EVENT_CATEGORY_ORDER: Ga4EventCategory[] = ['recomendados', 'b2b'];

/**
 * Eventos Medusa GENÉRICOS que el usuario puede mapear a GA4 (medusa_event →
 * ga4_event + params libres). Curado: solo eventos de ciclo de vida con valor
 * analítico. Los del embudo ecommerce viven en BUILTIN_GA4_EVENTS (payload fijo).
 */
export const SUPPORTED_EVENTS: SupportedEvent[] = [
  // --- Recomendados (universales, alto valor) ---
  { medusa_event: 'customer.created', category: 'recomendados', suggested_ga4: 'sign_up', params: ['method'] },
  // Envío del formulario de contacto = lead. El evento lo emite la ruta
  // /store/contact-submissions (ver src/api/store/contact-submissions/route.ts).
  { medusa_event: 'contact.submission_created', category: 'recomendados', suggested_ga4: 'generate_lead', params: [] },

  // --- Empresas y corporativo (B2B) ---
  // company.created: alta directa (siempre 'active', sin aprobación) → sign_up.
  { medusa_event: 'company.created', category: 'b2b', suggested_ga4: 'sign_up', params: [] },
  { medusa_event: 'company.member.joined', category: 'b2b', suggested_ga4: 'join_group', params: ['group_id'] },
  // corporate.created: formulario enviado (queda 'pending' hasta aprobación) = lead.
  { medusa_event: 'corporate.created', category: 'b2b', suggested_ga4: 'generate_lead', params: [] },
  // corporate.activated: aprobado por el admin (pasa a 'active') → sign_up.
  { medusa_event: 'corporate.activated', category: 'b2b', suggested_ga4: 'sign_up', params: [] },
  { medusa_event: 'corporate.member.joined', category: 'b2b', suggested_ga4: 'join_group', params: ['group_id'] },
  // corporate.suspended: el admin suspende la cuenta (pasa a 'suspended') → churn B2B.
  { medusa_event: 'corporate.suspended', category: 'b2b', suggested_ga4: 'corporate_suspended', params: [] },
  // corporate.member.invited: se invitó a un miembro (aún no aceptó).
  { medusa_event: 'corporate.member.invited', category: 'b2b', suggested_ga4: 'corporate_member_invited', params: [] },
  // corporate.rule.updated: cambió una regla de compra/aprobación del corporate.
  { medusa_event: 'corporate.rule.updated', category: 'b2b', suggested_ga4: 'corporate_rule_updated', params: [] },
];

export const SUPPORTED_EVENT_NAMES = SUPPORTED_EVENTS.map((e) => e.medusa_event);

/**
 * Eventos del embudo ecommerce que ANTES mandaba el plugin
 * @variablevic/google-analytics-medusa y ahora dispara este módulo. Tienen
 * payload fijo (items/value/currency calculados de la orden/carrito), así que
 * NO son mapeos genéricos: se configuran (activar/desactivar + renombrar el
 * evento GA4) vía Ga4BuiltinSetting. `trigger_event` es el evento Medusa que los
 * dispara; `builder` la clave del payload-builder en lib/builtin-dispatchers.
 */
export type Ga4BuiltinKey =
  | 'purchase'
  | 'refund'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'add_shipping_info'
  | 'add_payment_info';

export type BuiltinGa4Event = {
  builtin_key: Ga4BuiltinKey;
  trigger_event: string;
  default_ga4_event: string;
  category: Ga4EventCategory;
};

export const BUILTIN_GA4_EVENTS: BuiltinGa4Event[] = [
  { builtin_key: 'purchase', trigger_event: 'order.placed', default_ga4_event: 'purchase', category: 'recomendados' },
  { builtin_key: 'refund', trigger_event: 'payment.refunded', default_ga4_event: 'refund', category: 'recomendados' },
  { builtin_key: 'add_to_cart', trigger_event: 'cart.updated', default_ga4_event: 'add_to_cart', category: 'recomendados' },
  { builtin_key: 'remove_from_cart', trigger_event: 'cart.updated', default_ga4_event: 'remove_from_cart', category: 'recomendados' },
  { builtin_key: 'add_shipping_info', trigger_event: 'cart.updated', default_ga4_event: 'add_shipping_info', category: 'recomendados' },
  { builtin_key: 'add_payment_info', trigger_event: 'payment-session.created', default_ga4_event: 'add_payment_info', category: 'recomendados' },
];

/** Eventos Medusa que dispara el subscriber de built-ins (deduplicados). */
export const BUILTIN_TRIGGER_EVENTS = Array.from(
  new Set(BUILTIN_GA4_EVENTS.map((e) => e.trigger_event))
);

/** Quién envía un evento que ya está cubierto fuera de este módulo. */
export type Ga4ManagedSource = 'plugin' | 'storefront';

export type ManagedGa4Event = {
  ga4_event: string;
  source: Ga4ManagedSource;
};

/**
 * Eventos que se muestran como "ya activo" de solo lectura porque los dispara el
 * storefront (client-side) y NO pueden gestionarse desde el backend. Solo queda
 * begin_checkout (view_item se quitó por decisión de producto; el resto del
 * embudo server-side pasó a BUILTIN_GA4_EVENTS y ahora es configurable).
 */
export const MANAGED_GA4_EVENTS: ManagedGa4Event[] = [
  { ga4_event: 'begin_checkout', source: 'storefront' },
];
