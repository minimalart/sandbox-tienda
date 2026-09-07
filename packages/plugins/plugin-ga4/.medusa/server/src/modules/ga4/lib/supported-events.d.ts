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
export declare const GA4_EVENT_CATEGORY_ORDER: Ga4EventCategory[];
/**
 * Eventos Medusa GENÉRICOS que el usuario puede mapear a GA4 (medusa_event →
 * ga4_event + params libres). Curado: solo eventos de ciclo de vida con valor
 * analítico. Los del embudo ecommerce viven en BUILTIN_GA4_EVENTS (payload fijo).
 */
export declare const SUPPORTED_EVENTS: SupportedEvent[];
export declare const SUPPORTED_EVENT_NAMES: string[];
/**
 * Eventos del embudo ecommerce que ANTES mandaba el plugin
 * @variablevic/google-analytics-medusa y ahora dispara este módulo. Tienen
 * payload fijo (items/value/currency calculados de la orden/carrito), así que
 * NO son mapeos genéricos: se configuran (activar/desactivar + renombrar el
 * evento GA4) vía Ga4BuiltinSetting. `trigger_event` es el evento Medusa que los
 * dispara; `builder` la clave del payload-builder en lib/builtin-dispatchers.
 */
export type Ga4BuiltinKey = 'purchase' | 'refund' | 'add_to_cart' | 'remove_from_cart' | 'add_shipping_info' | 'add_payment_info';
export type BuiltinGa4Event = {
    builtin_key: Ga4BuiltinKey;
    trigger_event: string;
    default_ga4_event: string;
    category: Ga4EventCategory;
};
export declare const BUILTIN_GA4_EVENTS: BuiltinGa4Event[];
/** Eventos Medusa que dispara el subscriber de built-ins (deduplicados). */
export declare const BUILTIN_TRIGGER_EVENTS: string[];
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
export declare const MANAGED_GA4_EVENTS: ManagedGa4Event[];
