import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/**
 * Despacha eventos GENÉRICOS (mapeos medusa_event → ga4_event definidos por el
 * usuario) a GA4 server-side vía Measurement Protocol. Los eventos del embudo
 * ecommerce los maneja ga4-ecommerce-dispatcher.ts. Si faltan las credenciales
 * hace no-op; nunca lanza (cualquier fallo se loguea).
 */
export default function ga4DispatcherHandler({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
