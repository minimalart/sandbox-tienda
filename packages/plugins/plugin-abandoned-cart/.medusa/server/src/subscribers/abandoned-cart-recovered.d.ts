import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/**
 * Cuando una orden se crea, si su carrito estaba en seguimiento lo marca como
 * `recovered` para cortar la secuencia de recordatorios. Fire-and-forget: nunca
 * propaga al event bus.
 */
export default function handleAbandonedCartRecovered({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
