import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
export default function handleLoyaltySignup({ event, container, }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
