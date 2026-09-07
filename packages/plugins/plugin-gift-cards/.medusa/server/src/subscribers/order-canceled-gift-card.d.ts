import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
/** Cancels only unissued intents. Official cards already issued remain untouched. */
export default function giftCardOrderCanceled({ event, container }: SubscriberArgs<{
    id: string;
}>): Promise<void>;
export declare const config: SubscriberConfig;
