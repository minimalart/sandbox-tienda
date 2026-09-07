import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/** Creates idempotent intents and reconciles the capture-before-order race. */
export default function giftCardOrderPlaced({ event, container }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
