import type { MedusaContainer } from '@medusajs/framework/types';
export declare function processGiftCardLifecycle(container: MedusaContainer): Promise<{
    expiring: number;
    reminders: number;
}>;
