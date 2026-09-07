import type { SiteColumnScope, SiteScopeDescriptor } from '../../lib/multistore/scope';
export declare const GIFT_CARD_DELIVERY_SITE_SCOPE: SiteScopeDescriptor;
/**
 * `empty: 'all'` — el diseño sin tienda es el GLOBAL, disponible en todas.
 *
 * No es "sin asignar": incluye al `brand-default` que el servicio siembra, y sin él una
 * tienda se quedaría sin ningún diseño para ofrecer.
 */
export declare const GIFT_CARD_DESIGN_SITE_SCOPE: SiteColumnScope;
