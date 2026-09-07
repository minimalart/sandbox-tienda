"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANAGED_GA4_EVENTS = exports.BUILTIN_TRIGGER_EVENTS = exports.BUILTIN_GA4_EVENTS = exports.SUPPORTED_EVENT_NAMES = exports.SUPPORTED_EVENTS = exports.GA4_EVENT_CATEGORY_ORDER = void 0;
/**
 * Orden de categorías para la UI. "Recomendados" va primero.
 * Las etiquetas visibles se resuelven vía i18n (translations/ga4-events).
 */
exports.GA4_EVENT_CATEGORY_ORDER = ['recomendados', 'b2b'];
/**
 * Eventos Medusa GENÉRICOS que el usuario puede mapear a GA4 (medusa_event →
 * ga4_event + params libres). Curado: solo eventos de ciclo de vida con valor
 * analítico. Los del embudo ecommerce viven en BUILTIN_GA4_EVENTS (payload fijo).
 */
exports.SUPPORTED_EVENTS = [
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
exports.SUPPORTED_EVENT_NAMES = exports.SUPPORTED_EVENTS.map((e) => e.medusa_event);
exports.BUILTIN_GA4_EVENTS = [
    { builtin_key: 'purchase', trigger_event: 'order.placed', default_ga4_event: 'purchase', category: 'recomendados' },
    { builtin_key: 'refund', trigger_event: 'payment.refunded', default_ga4_event: 'refund', category: 'recomendados' },
    { builtin_key: 'add_to_cart', trigger_event: 'cart.updated', default_ga4_event: 'add_to_cart', category: 'recomendados' },
    { builtin_key: 'remove_from_cart', trigger_event: 'cart.updated', default_ga4_event: 'remove_from_cart', category: 'recomendados' },
    { builtin_key: 'add_shipping_info', trigger_event: 'cart.updated', default_ga4_event: 'add_shipping_info', category: 'recomendados' },
    { builtin_key: 'add_payment_info', trigger_event: 'payment-session.created', default_ga4_event: 'add_payment_info', category: 'recomendados' },
];
/** Eventos Medusa que dispara el subscriber de built-ins (deduplicados). */
exports.BUILTIN_TRIGGER_EVENTS = Array.from(new Set(exports.BUILTIN_GA4_EVENTS.map((e) => e.trigger_event)));
/**
 * Eventos que se muestran como "ya activo" de solo lectura porque los dispara el
 * storefront (client-side) y NO pueden gestionarse desde el backend. Solo queda
 * begin_checkout (view_item se quitó por decisión de producto; el resto del
 * embudo server-side pasó a BUILTIN_GA4_EVENTS y ahora es configurable).
 */
exports.MANAGED_GA4_EVENTS = [
    { ga4_event: 'begin_checkout', source: 'storefront' },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3VwcG9ydGVkLWV2ZW50cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2dhNC9saWIvc3VwcG9ydGVkLWV2ZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFhQTs7O0dBR0c7QUFDVSxRQUFBLHdCQUF3QixHQUF1QixDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUVwRjs7OztHQUlHO0FBQ1UsUUFBQSxnQkFBZ0IsR0FBcUI7SUFDaEQsaURBQWlEO0lBQ2pELEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRTtJQUM1RyxzRUFBc0U7SUFDdEUsK0VBQStFO0lBQy9FLEVBQUUsWUFBWSxFQUFFLDRCQUE0QixFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0lBRXBILHVDQUF1QztJQUN2Qyw4RUFBOEU7SUFDOUUsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUU7SUFDMUYsRUFBRSxZQUFZLEVBQUUsdUJBQXVCLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFO0lBQzdHLG1GQUFtRjtJQUNuRixFQUFFLFlBQVksRUFBRSxtQkFBbUIsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRTtJQUNsRywwRUFBMEU7SUFDMUUsRUFBRSxZQUFZLEVBQUUscUJBQXFCLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUU7SUFDOUYsRUFBRSxZQUFZLEVBQUUseUJBQXlCLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxDQUFDLFVBQVUsQ0FBQyxFQUFFO0lBQy9HLHFGQUFxRjtJQUNyRixFQUFFLFlBQVksRUFBRSxxQkFBcUIsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0lBQzFHLG9FQUFvRTtJQUNwRSxFQUFFLFlBQVksRUFBRSwwQkFBMEIsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSwwQkFBMEIsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0lBQ3BILCtFQUErRTtJQUMvRSxFQUFFLFlBQVksRUFBRSx3QkFBd0IsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO0NBQ2pILENBQUM7QUFFVyxRQUFBLHFCQUFxQixHQUFHLHdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBeUJwRSxRQUFBLGtCQUFrQixHQUFzQjtJQUNuRCxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRTtJQUNuSCxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFO0lBQ25ILEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFO0lBQ3pILEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRTtJQUNuSSxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUU7SUFDckksRUFBRSxXQUFXLEVBQUUsa0JBQWtCLEVBQUUsYUFBYSxFQUFFLHlCQUF5QixFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUU7Q0FDL0ksQ0FBQztBQUVGLDRFQUE0RTtBQUMvRCxRQUFBLHNCQUFzQixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQzlDLElBQUksR0FBRyxDQUFDLDBCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQ3hELENBQUM7QUFVRjs7Ozs7R0FLRztBQUNVLFFBQUEsa0JBQWtCLEdBQXNCO0lBQ25ELEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUU7Q0FDdEQsQ0FBQyJ9