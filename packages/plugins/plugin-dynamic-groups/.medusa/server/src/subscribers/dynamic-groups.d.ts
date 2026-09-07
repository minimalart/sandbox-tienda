import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/**
 * Tiempo real: ante una compra o un alta/actualización de cliente, reevalúa al
 * cliente afectado contra todos los grupos dinámicos activos y lo agrega/quita
 * de los customer_groups nativos al instante.
 */
export default function dynamicGroupsSyncHandler({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
