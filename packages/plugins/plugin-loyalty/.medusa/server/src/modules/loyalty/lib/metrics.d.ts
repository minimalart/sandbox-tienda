import type { CustomerMetrics } from './tiers';
export declare function gatherCustomerMetrics(container: {
    resolve: (k: string) => any;
}, customerId: string): Promise<CustomerMetrics>;
