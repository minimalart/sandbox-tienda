import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
export default function handleLoyaltyOrderCanceled({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
