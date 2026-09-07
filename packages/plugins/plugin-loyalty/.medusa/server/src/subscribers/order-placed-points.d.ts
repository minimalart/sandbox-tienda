import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
export default function handlePointsOrderPlaced({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
