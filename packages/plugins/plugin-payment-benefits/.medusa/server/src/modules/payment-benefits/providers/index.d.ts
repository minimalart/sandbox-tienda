import type { PaymentProviderCode } from '../types';
import type { PaymentBenefitProvider } from './types';
/**
 * Registro de adapters por código de proveedor. Agregar un proveedor nuevo
 * (MODO, Payway, …) es solo sumar su adapter acá; ni el modelo ni la UI cambian.
 */
export declare const PROVIDERS: Record<string, PaymentBenefitProvider>;
export declare function getProvider(code: PaymentProviderCode | string): PaymentBenefitProvider | null;
export type { PaymentBenefitProvider, ProviderContext } from './types';
