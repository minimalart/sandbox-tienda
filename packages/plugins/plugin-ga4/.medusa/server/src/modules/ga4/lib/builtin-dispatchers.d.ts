import type { Ga4BuiltinKey } from './supported-events';
/**
 * Payload-builders de los eventos ecommerce, portados del plugin
 * @variablevic/google-analytics-medusa (subscribers order-placed / cart-updated /
 * payment-session-created). Cada builder resuelve el client_id desde el metadata
 * y arma los params (items/value/currency) vía query.graph. Devuelve null para
 * saltear (sin client_id, sin entidad, o condición de cambio no aplicable).
 */
export type BuiltGa4Payload = {
    clientId: string;
    userId?: string;
    params: Record<string, unknown>;
};
type ContainerLike = {
    resolve: (key: string) => unknown;
};
export declare const BUILTIN_BUILDERS: Record<Ga4BuiltinKey, (container: ContainerLike, data: any) => Promise<BuiltGa4Payload | null>>;
export {};
