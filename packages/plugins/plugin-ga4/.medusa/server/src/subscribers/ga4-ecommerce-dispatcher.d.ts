import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/**
 * Dispatcher de los eventos del embudo ecommerce (portados del plugin
 * @variablevic/google-analytics-medusa, ahora desactivado). Escucha los eventos
 * Medusa que los disparan y enruta al built-in correspondiente. Cada built-in
 * chequea su propio setting (activo + nombre GA4) en el servicio.
 *
 * No-op si falta el measurement id o el api secret, sea cual sea su origen
 * (card de app-settings, fila legacy `ga4_settings` o env). Nunca lanza.
 */
export default function ga4EcommerceDispatcherHandler({ event, container, }: SubscriberArgs<{
    id: string;
    changes?: any;
    payment_session?: any;
}>): Promise<void>;
export declare const config: SubscriberConfig;
