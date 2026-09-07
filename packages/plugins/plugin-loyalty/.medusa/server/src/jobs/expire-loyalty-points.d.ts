import type { MedusaContainer } from '@medusajs/framework/types';
export declare const config: {
    name: string;
    schedule: string;
};
export default function expireLoyaltyPointsJob(container: MedusaContainer): Promise<void>;
